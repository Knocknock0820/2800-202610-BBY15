# 🌱 Sprout

> A web application designed to empower Vancouver residents to grow their own food at home — on balconies, windowsills, or patios — directly supporting the City's Food Security initiative.

---

## Technologies Used

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- EJS (Embedded JavaScript Templating)

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- PostgreSQL

### Other Tools & Services
- **Cloudinary** — image hosting & management
- **Multer + multer-storage-cloudinary** — file uploads
- **Google Gemini API** — AI-generated plant descriptions and images
- **OpenWeather API** — weather data for plant care recommendations
- **Netlify / Render** — deployment
- **Git & GitHub** — version control

---

## File Structure

```

.
├── about.html
├── app.js
├── config
│   ├── MongoDB.js
│   └── PostgreSQL.js
├── controllers
│   └── weatherController.js
├── dbModels
│   ├── MongoDB
│   └── PostgreSQL
├── middleware
│   └── upload.js
├── node_modules
│   ├── @google
│   ├── @hapi
│   ├── @mongodb-js
│   ├── @protobufjs
│   ├── @standard-schema
│   ├── @types
│   ├── accepts
│   ├── agent-base
│   ├── anymatch
│   ├── append-field
│   ├── asn1.js
│   ├── balanced-match
│   ├── base64-js
│   ├── bcrypt
│   ├── bignumber.js
│   ├── binary-extensions
│   ├── bn.js
│   ├── body-parser
│   ├── brace-expansion
│   ├── braces
│   ├── bson
│   ├── buffer-equal-constant-time
│   ├── buffer-from
│   ├── busboy
│   ├── bytes
│   ├── call-bind-apply-helpers
│   ├── call-bound
│   ├── chokidar
│   ├── cloudinary
│   ├── cloudinary-core
│   ├── concat-stream
│   ├── connect-mongo
│   ├── content-disposition
│   ├── content-type
│   ├── cookie
│   ├── cookie-signature
│   ├── core-js
│   ├── data-uri-to-buffer
│   ├── debug
│   ├── depd
│   ├── dotenv
│   ├── dunder-proto
│   ├── ecdsa-sig-formatter
│   ├── ee-first
│   ├── ejs
│   ├── encodeurl
│   ├── es-define-property
│   ├── es-errors
│   ├── es-object-atoms
│   ├── escape-html
│   ├── etag
│   ├── express
│   ├── express-mongo-sanitize
│   ├── express-session
│   ├── extend
│   ├── fetch-blob
│   ├── fill-range
│   ├── finalhandler
│   ├── formdata-polyfill
│   ├── forwarded
│   ├── fresh
│   ├── fsevents
│   ├── function-bind
│   ├── gaxios
│   ├── gcp-metadata
│   ├── get-intrinsic
│   ├── get-proto
│   ├── glob-parent
│   ├── google-auth-library
│   ├── google-logging-utils
│   ├── gopd
│   ├── has-flag
│   ├── has-symbols
│   ├── hasown
│   ├── http-errors
│   ├── https-proxy-agent
│   ├── iconv-lite
│   ├── ignore-by-default
│   ├── inherits
│   ├── install
│   ├── ipaddr.js
│   ├── is-binary-path
│   ├── is-extglob
│   ├── is-glob
│   ├── is-number
│   ├── is-promise
│   ├── joi
│   ├── json-bigint
│   ├── jwa
│   ├── jws
│   ├── kruptein
│   ├── lodash
│   ├── long
│   ├── marked
│   ├── math-intrinsics
│   ├── media-typer
│   ├── memory-pager
│   ├── merge-descriptors
│   ├── mime-db
│   ├── mime-types
│   ├── minimalistic-assert
│   ├── minimatch
│   ├── mongodb
│   ├── mongodb-connection-string-url
│   ├── ms
│   ├── multer
│   ├── multer-storage-cloudinary
│   ├── negotiator
│   ├── node-addon-api
│   ├── node-domexception
│   ├── node-fetch
│   ├── node-gyp-build
│   ├── nodemon
│   ├── normalize-path
│   ├── object-inspect
│   ├── on-finished
│   ├── on-headers
│   ├── once
│   ├── p-retry
│   ├── parseurl
│   ├── path-to-regexp
│   ├── picomatch
│   ├── protobufjs
│   ├── proxy-addr
│   ├── pstree.remy
│   ├── punycode
│   ├── q
│   ├── qs
│   ├── random-bytes
│   ├── range-parser
│   ├── raw-body
│   ├── readable-stream
│   ├── readdirp
│   ├── retry
│   ├── router
│   ├── safe-buffer
│   ├── safer-buffer
│   ├── semver
│   ├── send
│   ├── serve-static
│   ├── setprototypeof
│   ├── side-channel
│   ├── side-channel-list
│   ├── side-channel-map
│   ├── side-channel-weakmap
│   ├── simple-update-notifier
│   ├── sparse-bitfield
│   ├── statuses
│   ├── streamsearch
│   ├── string_decoder
│   ├── supports-color
│   ├── to-regex-range
│   ├── toidentifier
│   ├── touch
│   ├── tr46
│   ├── type-is
│   ├── typedarray
│   ├── uid-safe
│   ├── undefsafe
│   ├── undici-types
│   ├── unpipe
│   ├── util-deprecate
│   ├── vary
│   ├── web-streams-polyfill
│   ├── webidl-conversions
│   ├── whatwg-url
│   ├── wrappy
│   └── ws
├── package-lock.json
├── package.json
├── public
│   ├── css
│   ├── descriptions
│   ├── icons
│   ├── images
│   └── js
├── README.md
├── requirement.txt
├── routes
│   └── weatherApi.js
├── sample.env
├── scripts
│   ├── addSpecies.js
│   ├── bulkAddPlants.js
│   ├── gemini-output
│   ├── generatePlantAssets.js
│   ├── plant-list.txt
│   ├── README.md
│   └── testGeminiPlant.js
├── services
│   └── weatherService.js
└── views
    ├── 404.ejs
    ├── about.ejs
    ├── community.ejs
    ├── details_loading.ejs
    ├── details.ejs
    ├── landing.ejs
    ├── login.ejs
    ├── mainpage.ejs
    ├── partials
    ├── profile.ejs
    └── signup.ejs

188 directories, 29 files
```

---

## How to Install and Run the Project

### Prerequisites

Make sure the following are installed on your machine before cloning the repo:

| Requirement | Version | Notes |
|---|---|---|
| Node.js | v18+ | https://nodejs.org |
| npm | v9+ | Comes with Node.js |
| Git | Latest | https://git-scm.com |
| VS Code (recommended) | Latest | https://code.visualstudio.com |
| MongoDB | Local or Atlas | https://www.mongodb.com/atlas |


---

### Step-by-Step Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/Knocknock0820/2800-202610-BBY15.git
cd "tab"
```

#### 2. Install Dependencies

```bash
npm install express cloudinary multer multer-storage-cloudinary --legacy-peer-deps
npm install
```

> The `--legacy-peer-deps` flag is required due to peer dependency conflicts with the current multer and Cloudinary versions.

#### 3. Set Up Environment Variables

Copy the sample environment file and fill in your credentials:

```bash
cp sample.env .env
```

Open `.env` and add the following values:

```env
# Server
PORT=3000

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_pg_username
PG_PASSWORD=your_pg_password
PG_DATABASE=sprout_db

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Weather API
WEATHER_API_KEY=your_openweather_api_key
```

> ⚠️ **Never commit your `.env` file.** It is already listed in `.gitignore`. Store admin credentials in a separate `passwords.txt` file and submit it via D2L — do not push it to GitHub.

#### 4. Initialize the Database

MongoDB connections are handled automatically via `config/MongoDB.js` when the server starts. To seed the plant data, run:

```bash
node scripts/seedPlants.js
```

#### 5. Run the Application

```bash
node app.js
```

Or with auto-reload during development:

```bash
npx nodemon app.js
```

Visit: **http://localhost:3000**

---

### API Keys You Will Need

| Service | Where to Get It |
|---|---|
| Cloudinary | https://cloudinary.com — free tier available |
| Google Gemini | https://makersuite.google.com/app/apikey |
| OpenWeather | https://openweathermap.org/api |
| MongoDB Atlas | https://www.mongodb.com/atlas |

---

## Testing Plan

📋 **Link to Testing Plan:** *( https://docs.google.com/spreadsheets/d/1WNnyRI-34-B5dgb9ax4P7UX0Nw9yDpvo/edit?usp=sharing&ouid=100380268772405272718&rtpof=true&sd=true )*

---

## How to Use the Product (Features)

- **Browse Plants** — Explore a catalogue of plants with growing guides, care tips, and lifecycle image galleries (seed → sprout → mature → harvest).
- **Plant Detail Pages** — Each plant has a dedicated page with descriptions, ideal conditions (sun, water, space), and step-by-step growing instructions.
- **User Accounts** — Sign up and log in to track your own garden progress and save favourite plants.
- **Profile Page** — View and manage your personal and and account details.
- **Community Page** — Post updates, share your growing journey.
- **Weather Integration** — Real-time local weather data to help you decide when to water, move plants indoors, etc.
- **About Page** — Learn about the Sprout mission and team.

---

## Credits, References, and Licenses

### Team

*(List team member names and roles here)*

### References

- [Express.js Documentation](https://expressjs.com)
- [MongoDB Documentation](https://www.mongodb.com/docs)
- [Cloudinary Node SDK](https://cloudinary.com/documentation/node_integration)
- [Google Gemini API](https://ai.google.dev)
- [OpenWeatherMap API](https://openweathermap.org/api)
- [EJS Templating](https://ejs.co)

### Licenses

This project is for educational use as part of BCIT COMP 2800. All plant images and descriptions generated with Gemini are used for non-commercial academic purposes.

---

## AI and API Usage

### Google Gemini API

**Used for:** Generating plant descriptions and plant images programmatically.

**How:** The `scripts/testGeminiPlant.js` and `scripts/addSpecies.js` scripts send requests to the Gemini API with a plant name and prompt. The API returns a structured text description (stored as `.txt` in `scripts/gemini-output/`) and an image (stored as `.png`). These are then used to populate the plant database via `scripts/bulkAddPlants.js`.

### OpenWeather API

**Used for:** Displaying current local weather conditions on the main page to support planting decisions.

**How:** `services/weatherService.js` fetches current weather data by city/coordinates. `controllers/weatherController.js` processes this and passes it to the EJS view. Route defined in `routes/weatherApi.js`.

### Cloudinary

**Used for:** Storing and serving user-uploaded plant photos from the community and profile pages.

**How:** `middleware/upload.js` uses multer with `multer-storage-cloudinary` to intercept file uploads and stream them directly to Cloudinary. The returned secure URL is saved to the database.

---

## Contact Information

| Name | Role | GitHub | Email |
|---|---|---|---|
| Steven Chi | *(Handled backend routing and database integration.)* | [Knocknock0820](https://github.com/Knocknock0820) | *(steven82036@gmail.com)* |
| Harun Yaprak | *(Handled backend routing and database integration.)* | [Riloax](https://github.com/Riloax) | harun.cy2003@gmail.com |
| Shivika Kapoor | *(Handled backend routing and database integration.)* | [shivikakapoor](https://github.com/shivikakapoor) | Shivikakapoor04@gmail.com |
| Alex Minty | *(Handled backend routing and database integration.)* | [alexMinty102](https://github.com/alexMinty102) | mintya03@gmail.com |
| Justin Watson | *(Handled backend routing and database integration.)* | [JustinisLost](https://github.com/JustinisLost) | justinwatson480@gmail.com |

---

*Sprout by Team BBY-15 at BCIT COMP 2800, 2026*