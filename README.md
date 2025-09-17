[🔗 GitHub Repository](https://github.com/jankojjs/react-static-prerender)

[![npm version](https://img.shields.io/npm/v/react-static-prerender.svg)](https://www.npmjs.com/package/react-static-prerender)
[![MIT license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
# react-static-prerender

A lightweight CLI tool that converts your React SPA into static HTML files, each acting as a standalone entry point.

## Features

- Prerender specified React app routes into static HTML files
- **Dynamic route generation** from files, APIs, or databases
- Flexible output structure (flat files or nested directories)
- Outputs static pages in a configurable directory
- Supports custom route lists via `prerender.config.js`
- Copies static assets excluding HTML files
- Easy-to-use CLI with debug support
- Cross-platform compatibility
- Skip volatile elements during prerender to prevent hydration mismatches (using skipPrerenderSelector)
- Set custom viewport dimensions for Puppeteer rendering (using viewport)

## Installation

Install as a development dependency:

    npm install --save-dev react-static-prerender

## Usage

### Basic Setup

1. Create a `prerender.config.js` file in your project root to specify routes, input build directory, and output directory.

   **Static Routes Example**

   If your project has `"type": "module"` in package.json:
    ```js
    export default {
      routes: ["/", "/about", "/contact"],
      outDir: "static-pages",
      serveDir: "build",
      flatOutput: false, // Optional: true for about.html, false for about/index.html
      buildCommand: "npm run build", // Default, can be omitted
      skipPrerenderSelector: '[data-skip-prerender]', // Optional: elements to skip during prerender
      viewport: { width: 1200, height: 800 } // Optional, can be omitted
    };
    ```

   **For Vite/Yarn/PNPM projects:**
   ```js
   export default {
     routes: ["/", "/about", "/contact"],
     outDir: "static-pages", 
     serveDir: "dist", // Vite uses 'dist'
     buildCommand: "vite/yarn/pnpm build"
   };
   ```


   If your project uses CommonJS (no `"type": "module"`):
    ```js
    module.exports = {
        routes: ["/", "/about", "/contact"],
        outDir: "static-pages",
        serveDir: "build",
        flatOutput: false, // Optional: true for about.html, false for about/index.html
        skipPrerenderSelector: '[data-skip-prerender]'
   };
    ```

#### skipPrerenderSelector

If your React app has areas that change frequently on the client side (like ads, dynamic content, or responsive breakpoints), you can mark them with a `data-skip-prerender` attribute (or any CSS selector you prefer).  
These elements will be removed before Puppeteer captures the HTML, preventing FOUC and hydration mismatches.

#### viewport

You can optionally set a viewport size to emulate desktop or mobile when prerendering.  
If not set, Puppeteer will use its default 800x600 viewport.


### Dynamic Routes

For dynamic content like blog posts, product pages, or any data-driven routes, use a function-based configuration:

#### From Local Files (Markdown/JSON)

```js
// prerender.config.js
import fs from 'fs/promises';
import path from 'path';

export default async function() {
  // Read blog posts from markdown files
  const blogPosts = await getBlogPostsFromFiles();
  const blogRoutes = blogPosts.map(post => `/blog/${post.slug}`);
  
  return {
    routes: [
      "/",
      "/about", 
      "/blog",
      ...blogRoutes // Dynamic blog routes
    ],
    outDir: "static-pages",
    serveDir: "build",
    skipPrerenderSelector: '[data-skip-prerender]',
    viewport: { width: 1200, height: 800 }
  };
}

async function getBlogPostsFromFiles() {
  try {
    const postsDir = path.join(process.cwd(), 'content/blog');
    const files = await fs.readdir(postsDir);
    
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => ({
        slug: file.replace(/\.md$/, ''),
        filename: file
      }));
  } catch (error) {
    console.warn('⚠️  Could not read blog posts:', error.message);
    return [];
  }
}
```

#### From JSON Data

```js
// prerender.config.js
import fs from 'fs/promises';

export default async function() {
  let blogRoutes = [];
  
  try {
    const postsData = await fs.readFile('./src/data/posts.json', 'utf-8');
    const posts = JSON.parse(postsData);
    blogRoutes = posts.map(post => `/blog/${post.slug}`);
  } catch (error) {
    console.warn('⚠️  Could not load blog posts:', error.message);
  }
  
  return {
    routes: ["/", "/blog", ...blogRoutes],
    outDir: "static-pages",
    serveDir: "build"
  };
}
```

#### From External API/CMS

```js
// prerender.config.js
export default async function() {
  const blogRoutes = await getBlogRoutesFromAPI();
  
  return {
    routes: ["/", "/blog", ...blogRoutes],
    outDir: "static-pages",
    serveDir: "build"
  };
}

async function getBlogRoutesFromAPI() {
  try {
    // Example: Contentful, Strapi, Ghost, etc.
    const response = await fetch('https://your-cms.com/api/posts?fields=slug');
    const data = await response.json();
    
    return data.posts.map(post => `/blog/${post.slug}`);
  } catch (error) {
    console.warn('⚠️  Could not fetch from API:', error.message);
    return [];
  }
}
```

#### Multiple Dynamic Route Types

```js
// prerender.config.js
export default async function() {
  const [blogRoutes, productRoutes, categoryRoutes] = await Promise.all([
    getBlogRoutes(),
    getProductRoutes(), 
    getCategoryRoutes()
  ]);
  
  return {
    routes: [
      // Static routes
      "/",
      "/about",
      "/contact",
      
      // Dynamic routes
      ...blogRoutes,
      ...productRoutes,
      ...categoryRoutes
    ],
    outDir: "static-pages",
    serveDir: "build"
  };
}

async function getBlogRoutes() {
  // Your blog post logic here
  return ["/blog/getting-started", "/blog/advanced-tips"];
}

async function getProductRoutes() {
  // Your product logic here  
  return ["/products/widget-1", "/products/gadget-2"];
}

async function getCategoryRoutes() {
  // Your category logic here
  return ["/category/tech", "/category/design"];
}
```

#### CommonJS Version (for projects without `"type": "module"`)

```js
// prerender.config.js
const fs = require('fs/promises');

module.exports = async function() {
  const blogRoutes = await getBlogRoutes();
  
  return {
    routes: ["/", "/blog", ...blogRoutes],
    outDir: "static-pages",
    serveDir: "build"
  };
}

async function getBlogRoutes() {
  try {
    const postsData = await fs.readFile('./src/data/posts.json', 'utf-8');
    const posts = JSON.parse(postsData);
    return posts.map(post => `/blog/${post.slug}`);
  } catch (error) {
    console.warn('⚠️  Could not load blog posts:', error.message);
    return [];
  }
}
```

### Running the Tool

1. Make sure your React app is built and ready to be prerendered or run the command with --with-build flag.
2. Run the prerender command to generate static HTML pages.

```
npx react-static-prerender
```

If you want to automatically build before prerendering:

```
npx react-static-prerender --with-build
```

For debugging server issues:

```
npx react-static-prerender --debug
```

**(Optional)** Add an npm script to simplify future runs:

```json
"scripts": {
  "prerender": "react-static-prerender --with-build"
}
```

Then run with:

```
npm run prerender
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `routes` | `string[]` | `[]` | Array of routes to prerender (e.g., `["/", "/about"]`) |
| `outDir` | `string` | `"static-pages"` | Output directory for generated static files |
| `serveDir` | `string` | `"build"` | Directory containing your built React app |
| `buildCommand` | `string` | `"npm run build"` | Command to build your app when using `--with-build` |
| `flatOutput` | `boolean` | `false` | Output structure: `true` = `about.html`, `false` = `about/index.html` |
| `skipPrerenderSelector` | `string` | undefined | Optional CSS selector for elements to skip during prerender (e.g., '[data-skip-prerender]') |
| `viewport` | `{ width: number, height: number }` | undefined | Optional viewport dimensions for Puppeteer (default: 800x600) |

## CLI Options

| Flag | Description |
|------|-------------|
| `--with-build` | Runs `npm run build` before prerendering |
| `--debug` | Shows detailed server logs for troubleshooting |

## Output Structure

### Nested Structure (default: `flatOutput: false`)
```
static-pages/
├── index.html           # / route
├── about/
│   └── index.html       # /about route
├── blog/
│   └── index.html       # /blog route
├── blog/
│   ├── getting-started/
│   │   └── index.html   # /blog/getting-started route
│   └── advanced-tips/
│       └── index.html   # /blog/advanced-tips route
└── contact/
    └── index.html       # /contact route
```

### Flat Structure (`flatOutput: true`)
```
static-pages/
├── index.html                 # / route
├── about.html                 # /about route
├── blog.html                  # /blog route
├── blog-getting-started.html  # /blog/getting-started route
├── blog-advanced-tips.html    # /blog/advanced-tips route
└── contact.html               # /contact route
```

## Use Cases

### Perfect for:
- **Blog sites** with dynamic post generation
- **E-commerce** with product pages
- **Documentation sites** with dynamic content
- **Portfolio sites** with project pages
- **News sites** with article pages
- **Any SPA** with data-driven routes

## Why use this?

- **SEO Friendly**: Pre-generated HTML improves search engine crawling
- **Fast Loading**: Eliminates client-side rendering delay for initial page load
- **Static Hosting**: Perfect for CDNs, GitHub Pages, Netlify, Vercel
- **Dynamic Content**: Generate routes from any data source
- **Minimal Setup**: Simple configuration with sensible defaults
- **Flexible Output**: Choose between flat files or nested directory structure

## Requirements

- **Node.js 18 or higher**
- React app build ready for prerendering or run the command with --with-build flag

## Troubleshooting

### Build folder not found
Make sure your React app is built before running prerender, or use the `--with-build` flag.

### Server startup issues
Use the `--debug` flag to see detailed server logs:
```bash
npx react-static-prerender --debug
```

### Multiple passes for sites with responsive design
For sites with responsive design, you can run multiple prerender passes with different viewport sizes to capture different layouts.

### Port conflicts
The tool automatically finds available ports starting from 5050, so port conflicts should be rare.

### Dynamic route configuration errors
If you're having issues with dynamic routes:
1. Make sure your config file exports a function that returns a promise
2. Check that all imported modules are available
3. Use `--debug` to see detailed error messages

## Contributing

Contributions are welcome. Please keep code clean and follow best practices.

## License

MIT © Janko Stanic