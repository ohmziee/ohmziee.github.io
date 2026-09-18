# posting to Databytes

Every post is one object in `databytes.json`. Newest first is not required, the page sorts by date.

## fields
| field   | required | notes |
|---------|----------|-------|
| id      | yes      | any unique string, "0002", "0003"... |
| date    | yes      | YYYY-MM-DD |
| type    | yes      | `still` · `footage` · `audio` · `transmission` |
| title   | yes      | short |
| file    | for still/footage/audio | path in the repo, e.g. `media/alley03.jpg` |
| text    | optional | caption, or the whole post for a transmission |
| tags    | optional | array of strings, shown as filters |
| poster  | optional | footage only: a still shown before play, e.g. `media/alley03-poster.jpg` |

## examples
```json
{ "id": "0002", "date": "2026-09-20", "type": "still",
  "title": "alley 03", "file": "media/alley03.jpg",
  "text": "found this behind the mall.", "tags": ["stills","night"] }

{ "id": "0003", "date": "2026-09-21", "type": "audio",
  "title": "signal 41", "file": "media/signal41.mp3",
  "text": "own production. lo-fi pass.", "tags": ["audio"] }

{ "id": "0004", "date": "2026-09-22", "type": "footage",
  "title": "stairwell", "file": "media/stairwell.mp4",
  "poster": "media/stairwell.jpg", "tags": ["footage"] }
```

## workflow
1. upload the media file to the `media/` folder in the repo (phone: Add file → Upload)
2. open `databytes.json`, add the object, commit
3. live in ~30s

Delete a post = delete its object. Edit = edit the object.
Keep JSON valid: commas between objects, no trailing comma after the last one.
