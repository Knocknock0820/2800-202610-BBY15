# Species Management Scripts

This folder contains scripts for managing plant species data in the database.

## addSpecies.js

Add a new plant species to the database by auto-discovering image and description files.

### Usage

```bash
node scripts/addSpecies.js <name> <slug> <waterFreq> [difficulty]
```

### Examples

**Add Monstera:**

```bash
node scripts/addSpecies.js "Monstera" monstera "Every week" "Easy"
```

**Add Snake Plant:**

```bash
node scripts/addSpecies.js "Snake Plant" snake_plant "Once a month" "Easy"
```

### File Structure

The script expects files to be organized in specific locations:

**Images** (`public/images/`):

- Hero image: `{slug}.jpg` (e.g., `monstera.jpg`, `snake_plant.jpg`)
- Lifecycle images: `{slug}_{stage}.jpg` where stage is one of:
  - `seed`
  - `sprout`
  - `mature`
  - `flower`
  - `harvest`

**Descriptions** (`public/descriptions/`):

- Markdown file: `{slug}.md` (e.g., `monstera.md`, `snake_plant.md`)

### Before Adding a New Species

1. Place all image files in `public/images/` following the naming convention
2. Place the description markdown file in `public/descriptions/` as `{slug}.md`
3. Run the script with the correct name, slug, water frequency, and difficulty

### Notes

- The hero image is required; the script will abort if it's not found
- Lifecycle images and descriptions are optional but recommended
- The script uses `.jpg` files by default but will fall back to `.png` if `.jpg` is not found
- You can run the script multiple times for the same plant to update its data

## testGeminiPlant.js

Generate a short plant description with Gemini and download a matching plant photo set from Unsplash.

### Usage

```bash
node scripts/testGeminiPlant.js <plant name>
```

### Example

```bash
node scripts/testGeminiPlant.js monstera deliciosa
```

### Output

- Writes a short description to `public/descriptions/<plant>.md`
- Writes the hero image to `public/images/details/<plant>/<plant>.jpg`
- Writes lifecycle images to `public/images/details/<plant>/<plant>_seed.jpg`, `_sprout.jpg`, `_mature.jpg`, `_flower.jpg`, and `_harvest.jpg`
- Requires `GEMINI_API_KEY` and `UNSPLASH_ACCESS_KEY` in your environment
