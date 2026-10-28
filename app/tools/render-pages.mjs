import {renderPages} from '../.build/page-templates.mjs';

// Keep page documents in memory; the packager never needs intermediate HTML files.
process.stdout.write(JSON.stringify(renderPages()));
