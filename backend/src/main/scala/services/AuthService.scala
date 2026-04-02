package services

import javax.crypto.{Mac, SecretKeyFactory}
import javax.crypto.spec.{PBEKeySpec, SecretKeySpec}
import java.security.{SecureRandom, MessageDigest}
import java.util.Base64
import java.nio.file.{Files, Paths}
import scala.util.Try

object AuthService:
  private val PBKDF2_ITERATIONS = 65536
  private val PBKDF2_KEY_LENGTH = 256
  private val TOKEN_TTL_MS = 30L * 24 * 60 * 60 * 1000L  // 30 days

  private val serverSecret: Array[Byte] = loadOrGenerateSecret()

  private def loadOrGenerateSecret(): Array[Byte] =
    val path = Paths.get("server.secret")
    if Files.exists(path) then
      Base64.getDecoder.decode(new String(Files.readAllBytes(path)).trim)
    else
      val secret = new Array[Byte](32)
      SecureRandom().nextBytes(secret)
      Files.write(path, Base64.getEncoder.encodeToString(secret).getBytes)
      println(s"Generated new server secret: ${path.toAbsolutePath}")
      secret

  private def base64url(bytes: Array[Byte]): String =
    Base64.getUrlEncoder.withoutPadding.encodeToString(bytes)

  private def hmac(data: String): Array[Byte] =
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(serverSecret, "HmacSHA256"))
    mac.doFinal(data.getBytes("UTF-8"))

  def hashPassword(password: String): (String, String) =
    val saltBytes = new Array[Byte](16)
    SecureRandom().nextBytes(saltBytes)
    val salt = Base64.getEncoder.encodeToString(saltBytes)
    val hash = pbkdf2(password, saltBytes)
    (hash, salt)

  def verifyPassword(password: String, hash: String, salt: String): Boolean =
    Try {
      val saltBytes = Base64.getDecoder.decode(salt)
      val computed = pbkdf2(password, saltBytes)
      MessageDigest.isEqual(
        Base64.getDecoder.decode(hash),
        Base64.getDecoder.decode(computed)
      )
    }.getOrElse(false)

  private def pbkdf2(password: String, salt: Array[Byte]): String =
    val spec = PBEKeySpec(password.toCharArray, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH)
    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val hash = factory.generateSecret(spec).getEncoded
    Base64.getEncoder.encodeToString(hash)

  def generateToken(username: String): String =
    val issuedAt = System.currentTimeMillis().toString
    val payload = s"$username|$issuedAt"
    val sig = base64url(hmac(payload))
    s"${base64url(username.getBytes("UTF-8"))}.${base64url(issuedAt.getBytes("UTF-8"))}.$sig"

  def validateToken(token: String): Option[String] =
    token.split("\\.") match
      case Array(userB64, issuedAtB64, sigB64) =>
        Try {
          val username = new String(Base64.getUrlDecoder.decode(userB64), "UTF-8")
          val issuedAt = new String(Base64.getUrlDecoder.decode(issuedAtB64), "UTF-8").toLong
          val payload = s"$username|$issuedAt"
          val expectedSig = base64url(hmac(payload))
          val sigValid = MessageDigest.isEqual(
            Base64.getUrlDecoder.decode(sigB64),
            Base64.getUrlDecoder.decode(expectedSig)
          )
          val notExpired = System.currentTimeMillis() - issuedAt <= TOKEN_TTL_MS
          if sigValid && notExpired then Some(username) else None
        }.getOrElse(None)
      case _ => None
