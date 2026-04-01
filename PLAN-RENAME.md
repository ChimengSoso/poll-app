# Plan: Rename to OpenPoll + Restaurant → Choice

## Two independent rename axes

| Axis | From | To |
|---|---|---|
| App name | Restaurant Poll App | OpenPoll |
| Voteable item | `Restaurant` / `restaurant` / `restaurants` | `Choice` / `choice` / `choices` |

All changes are mechanical find-and-replace at the file level. No logic changes, no new features.

---

## Backend files

### `backend/build.sbt`
```
name := "poll-app-backend"          →  name := "openpoll-backend"
assemblyJarName := "poll-app.jar"   →  assemblyJarName := "openpoll.jar"
```

### `backend/src/main/scala/models/Poll.scala`
| Old | New |
|---|---|
| `case class Restaurant(` | `case class Choice(` |
| `case class RestaurantInput(` | `case class ChoiceInput(` |
| `restaurants: List[Restaurant]` | `choices: List[Choice]` (in Poll, PollResponse, CreatePollRequest, EditPollRequest) |
| `restaurants: List[RestaurantInput]` | `choices: List[ChoiceInput]` (in CreatePollRequest, EditPollRequest) |
| `VoteRequest.restaurantId: String` | `VoteRequest.choiceId: String` |
| `RemoveVoteRequest.restaurantId: String` | `RemoveVoteRequest.choiceId: String` |
| Comments: `// Each user can vote for only one restaurant` | `// Each user can vote for only one choice` |

### `backend/src/main/scala/actors/PollActor.scala`
| Old | New |
|---|---|
| `Vote(restaurantId, ...)` | `Vote(choiceId, ...)` |
| `RemoveVote(restaurantId, ...)` | `RemoveVote(choiceId, ...)` |
| `EditPoll(title, restaurants, ...)` | `EditPoll(title, choices, ...)` |
| All `restaurant` / `restaurants` local variables | `choice` / `choices` |
| `"Restaurant with id $restaurantId not found"` | `"Choice with id $choiceId not found"` |
| `"already voted for this restaurant"` | `"already voted for this choice"` |
| `"has not voted for this restaurant"` | `"has not voted for this choice"` |
| `poll.restaurants` references | `poll.choices` |
| `current.restaurants` references | `current.choices` |

### `backend/src/main/scala/actors/PollManager.scala`
| Old | New |
|---|---|
| `VotePoll(pollId, restaurantId, ...)` | `VotePoll(pollId, choiceId, ...)` |
| `RemovePollVote(pollId, restaurantId, ...)` | `RemovePollVote(pollId, choiceId, ...)` |
| `EditPoll(pollId, title, restaurants, ...)` | `EditPoll(pollId, title, choices, ...)` |
| `Restaurant(name = r.name, ...)` constructor | `Choice(name = r.name, ...)` |
| `request.restaurants.map(...)` | `request.choices.map(...)` |
| `poll.restaurants` references | `poll.choices` |
| All `restaurant` / `restaurants` local variables | `choice` / `choices` |

### `backend/src/main/scala/routes/PollRoutes.scala`
| Old | New |
|---|---|
| `voteRequest.restaurantId` | `voteRequest.choiceId` |
| `removeRequest.restaurantId` | `removeRequest.choiceId` |
| `editRequest.restaurants.map(r => Restaurant(...))` | `editRequest.choices.map(r => Choice(...))` |
| `template.restaurants.map(r => RestaurantInput(...))` | `template.choices.map(r => ChoiceInput(...))` |
| `restaurants = restaurants` (in CreatePollRequest) | `choices = choices` |

### `backend/src/main/scala/json/JsonFormats.scala`
| Old | New |
|---|---|
| `restaurantInputFormat` | `choiceInputFormat` |
| `restaurantFormat` | `choiceFormat` |
| `jsonFormat2(RestaurantInput.apply)` | `jsonFormat2(ChoiceInput.apply)` |
| `jsonFormat5(Restaurant.apply)` | `jsonFormat5(Choice.apply)` |

---

## Frontend files

### `frontend/package.json`
```
"name": "poll-app-frontend"   →   "name": "openpoll-frontend"
```

### `frontend/index.html` + `frontend/public/index.html` + `deploy/ui/index.html`
```html
<title>Restaurant Poll App</title>   →   <title>OpenPoll</title>
```

### `frontend/src/types/index.ts`
| Old | New |
|---|---|
| `export interface Restaurant {` | `export interface Choice {` |
| `export interface RestaurantInput {` | `export interface ChoiceInput {` |
| `restaurants: Restaurant[]` | `choices: Choice[]` (in Poll) |
| `restaurants: RestaurantInput[]` | `choices: ChoiceInput[]` (in CreatePollRequest, EditPollRequest) |
| `VoteRequest.restaurantId: string` | `VoteRequest.choiceId: string` |
| `RemoveVoteRequest.restaurantId: string` | `RemoveVoteRequest.choiceId: string` |

### `frontend/src/services/api.ts`
| Old | New |
|---|---|
| `vote(pollId, restaurantId, username)` | `vote(pollId, choiceId, username)` |
| `removeVote(pollId, restaurantId, username)` | `removeVote(pollId, choiceId, username)` |
| `VoteRequest = { restaurantId, username }` | `VoteRequest = { choiceId, username }` |
| `RemoveVoteRequest = { restaurantId, username }` | `RemoveVoteRequest = { choiceId, username }` |

### `frontend/src/contexts/UserContext.tsx`
```
localStorage.getItem('poll-app-username')    →   localStorage.getItem('openpoll-username')
localStorage.setItem('poll-app-username', …) →   localStorage.setItem('openpoll-username', …)
localStorage.removeItem('poll-app-username') →   localStorage.removeItem('openpoll-username')
```
> Note: existing users will be logged out once on first visit after deploy (expected for a rebrand).

### `frontend/src/App.tsx`
```
🍽️ Restaurant Poll App   →   🗳️ OpenPoll
```

### `frontend/src/components/Login.tsx`
| Old | New |
|---|---|
| `🍽️` emoji | `🗳️` |
| `Restaurant Poll App` title | `OpenPoll` |
| `"Enter your name to create and vote on restaurant polls"` | `"Create polls and vote on anything with your team"` |

### `frontend/src/components/VotePanel.tsx`
| Old | New |
|---|---|
| `import type { Poll, Restaurant }` | `import type { Poll, Choice }` |
| `const getWinners = (): Restaurant[]` | `const getWinners = (): Choice[]` |
| `const columnDefs: ColDef<Restaurant>[]` | `const columnDefs: ColDef<Choice>[]` |
| `headerName: 'Restaurant'` (column) | `headerName: 'Choice'` |
| `const restaurant = params.data` | `const choice = params.data` |
| `restaurant.voters` / `restaurant.id` | `choice.voters` / `choice.id` |
| `handleVote(restaurant.id)` | `handleVote(choice.id)` |
| `handleRemoveVote(restaurant.id)` | `handleRemoveVote(choice.id)` |
| `const handleVote = async (restaurantId)` | `const handleVote = async (choiceId)` |
| `const handleRemoveVote = async (restaurantId)` | `const handleRemoveVote = async (choiceId)` |
| `pollApi.vote(poll.id, restaurantId, …)` | `pollApi.vote(poll.id, choiceId, …)` |
| `pollApi.removeVote(poll.id, restaurantId, …)` | `pollApi.removeVote(poll.id, choiceId, …)` |
| `poll.restaurants.length` / `.map` / `.filter` | `poll.choices.length` / `.map` / `.filter` |
| `"vote for multiple restaurants"` alert text | `"vote for multiple choices"` |
| `rowData={poll.restaurants}` | `rowData={poll.choices}` |

### `frontend/src/components/Results.tsx`
| Old | New |
|---|---|
| `import type { Poll, Restaurant }` | `import type { Poll, Choice }` |
| `const sortedRestaurants` | `const sortedChoices` |
| `poll.restaurants` references | `poll.choices` |
| `(record: Restaurant)` type annotations | `(record: Choice)` |
| `(a: Restaurant, b: Restaurant)` sorter | `(a: Choice, b: Choice)` |
| `title: 'Restaurant'` (column header) | `title: 'Choice'` |
| `dataSource={sortedRestaurants}` | `dataSource={sortedChoices}` |

### `frontend/src/components/CreatePoll.tsx`
| Old | New |
|---|---|
| `restaurants: values.restaurants \|\| []` | `choices: values.choices \|\| []` |
| `values.restaurants` (export/import) | `values.choices` |
| `restaurants: [{ name: '', description: '' }]` initialValues | `choices: [{ name: '', description: '' }]` |
| `<Form.List name="restaurants">` | `<Form.List name="choices">` |
| `'Restaurant name required'` validation | `'Choice name required'` |
| `placeholder="Restaurant name"` | `placeholder="Choice"` |
| `Add Restaurant` button label | `Add Choice` |
| `"vote for multiple restaurants"` tooltip | `"vote for multiple choices"` |

### `frontend/src/components/EditPollModal.tsx`
| Old | New |
|---|---|
| `poll.restaurants.map(r => …)` | `poll.choices.map(r => …)` |
| `restaurants: values.restaurants \|\| []` | `choices: values.choices \|\| []` |
| `<Form.List name="restaurants">` | `<Form.List name="choices">` |
| `<label>Restaurants:</label>` | `<label>Choices:</label>` |
| `'Restaurant name required'` | `'Choice name required'` |
| `placeholder="Restaurant name"` | `placeholder="Choice"` |
| `Add Restaurant` button | `Add Choice` |
| `"Existing votes will be preserved if restaurant names match. New restaurants start with 0 votes."` | `"Existing votes will be preserved if choice names match. New choices start with 0 votes."` |

### `frontend/src/components/PollList.tsx`
| Old | New |
|---|---|
| `headerName: 'Restaurants'` | `headerName: 'Choices'` |
| `field: 'restaurants'` | `field: 'choices'` |
| `params.data?.restaurants.length` | `params.data?.choices.length` |

---

## Deploy / config files

### `build.sh`
```
poll-app.jar   →   openpoll.jar
```

### `deploy/poll-app-backend.service`
```
Description=Poll App Backend        →   Description=OpenPoll Backend
ExecStart=…/poll-app.jar            →   ExecStart=…/openpoll.jar
```
Also rename the file itself: `poll-app-backend.service` → `openpoll-backend.service`

### `deploy/start-backend.sh`
```
poll-app.jar   →   openpoll.jar
```

### `deploy/install.sh`
```
poll-app-backend.service   →   openpoll-backend.service
poll-app.jar               →   openpoll.jar
```

---

## Documentation files

### `CLAUDE.md`
```
poll-app.jar                       →   openpoll.jar
poll-app-backend.service           →   openpoll-backend.service
Restaurant Poll App (description)  →   OpenPoll
```

---

## What does NOT change

- All Scala package names (`package models`, `package actors`, `package routes`) — no impact
- Backend port (8080), nginx port (8081)
- All poll/voting logic, actor structure, SSE mechanism
- `PLAN.md` and `PLAN-AUTH.md` (planning docs, historical reference)
- The `poll-templates/` directory name (internal storage, not visible to users)
- The `sbt` assembly plugin and merge strategy

---

## Implementation order

1. Backend `models/Poll.scala` first — all other backend files depend on the renamed classes
2. Backend `actors/` and `routes/` — consume the renamed models
3. Backend `json/JsonFormats.scala` — format definitions
4. Backend `build.sbt` — artifact name
5. Frontend `types/index.ts` — all frontend components depend on this
6. Frontend `services/api.ts` — consumed by components
7. Frontend `contexts/UserContext.tsx` — consumed by App
8. Frontend components (`VotePanel`, `Results`, `CreatePoll`, `EditPollModal`, `PollList`)
9. Frontend `App.tsx` + `Login.tsx` — branding
10. HTML files + `package.json` — titles
11. Deploy + config files
12. `CLAUDE.md`

## Verification

- [ ] `sbt compile` passes — no unresolved references to `Restaurant`/`RestaurantInput`
- [ ] `npm run build` passes — no TypeScript errors on renamed types
- [ ] App title shows "OpenPoll" in browser tab and header
- [ ] Login page shows "OpenPoll" with 🗳️ emoji
- [ ] Create poll form shows "Add Choice" button and "Choice" placeholder
- [ ] Vote panel column header shows "Choice" (not "Restaurant")
- [ ] Results table column header shows "Choice"
- [ ] Poll list column header shows "Choices"
- [ ] API JSON payload uses `choices` field (verify in browser Network tab)
- [ ] Vote and remove-vote still work end-to-end
