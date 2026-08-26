# Chrome Web Store submission assets

Everything needed to submit `browser-extension/` to the Chrome Web Store,
except the parts that are a human's job (developer registration, upload,
and the actual publish action — per this repo's rule that store/marketplace
publication always requires human approval and action).

| File | Purpose |
|---|---|
| [`manifest-v3-review.md`](manifest-v3-review.md) | Manifest V3 / permissions review, single-purpose statement, remote-code disclosure, and ready-to-paste text for the Privacy practices tab |
| [`store-listing.md`](store-listing.md) | Summary (≤132 chars), detailed description, category, and asset checklist |
| [`icon-128.png`](icon-128.png) | Store icon, 128×128 |
| [`screenshots/`](screenshots/) | Two 1280×800 screenshots of the extension actually rendering diagrams |
| [`screenshot-sources/`](screenshot-sources/) | The `.puml` files used to generate the screenshots, for reproducibility |

The zip to upload is built by `npm run package:browser-extension`
(`plantuml-anywhere-browser-extension-<version>.zip` in the repo root, also
attached to [GitHub Releases](https://github.com/t29mato/plantuml-anywhere/releases)).

## What's left for the owner

1. **Register as a Chrome Web Store developer** (one-time $5 fee) at
   <https://chrome.google.com/webstore/devconsole>.
2. Create a new item, upload the zip, and paste in the copy from
   [`store-listing.md`](store-listing.md) and the assets above.
3. Fill in the "Privacy practices" tab using
   [`manifest-v3-review.md`](manifest-v3-review.md#data-usage--privacy-practices-tab).
4. Submit for review.

Everything else (permission minimization, listing copy, screenshots, icon,
package) is ready.
