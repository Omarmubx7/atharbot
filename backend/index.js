import express from 'express';
import cors from 'cors';
import fs from 'fs';
import Fuse from 'fuse.js';
import natural from 'natural';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Serve static files from frontend dist folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));
const dataPath = path.join(__dirname, 'office_hours.json');
console.log('Looking for data file at:', dataPath);
console.log('File exists:', fs.existsSync(dataPath));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
console.log('Loaded people:', data.length);

// Setup Fuse.js for smart search
const fuse = new Fuse(data, {
  keys: ['name'],
  threshold: 0.6, // Even more lenient
  ignoreLocation: true,
  minMatchCharLength: 1,
  includeScore: true,
});

const days = [
  'saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
];

const departments = Array.from(new Set(data.map(p => p.department.toLowerCase())));

function findByDay(day) {
  return data.filter(person =>
    Object.keys(person.office_hours).some(d => d.toLowerCase() === day)
  );
}

function findByDepartment(dept) {
  return data.filter(person =>
    person.department && person.department.toLowerCase().includes(dept)
  );
}

function findByName(name) {
  let results = fuse.search(name);
  if (results.length === 0) {
    results = data.filter(person =>
      person.name && person.name.toLowerCase().split(/\s+/).some(part => part.startsWith(name))
    ).map(item => ({ item, score: 0.5 }));
  }
  if (results.length === 0) {
    results = data.filter(person =>
      person.name && person.name.toLowerCase().includes(name)
    ).map(item => ({ item, score: 0.7 }));
  }
  results.sort((a, b) => (a.score || 1) - (b.score || 1));
  return results.map(r => r.item);
}

app.get('/api/person', (req, res) => {
  let { name } = req.query;
  if (!name) {
    return res.status(400).json({ error: 'Missing name parameter' });
  }
  name = name.trim().toLowerCase();
  // Fuzzy search (match any part of the name)
  let results = fuse.search(name);
  // If no results, fallback to substring search on any part of the name
  if (results.length === 0) {
    results = data.filter(person =>
      person.name && person.name.toLowerCase().split(/\s+/).some(part => part.startsWith(name))
    ).map(item => ({ item, score: 0.5 }));
  }
  // If still no results, fallback to includes
  if (results.length === 0) {
    results = data.filter(person =>
      person.name && person.name.toLowerCase().includes(name)
    ).map(item => ({ item, score: 0.7 }));
  }
  if (results.length === 0) {
    return res.status(404).json({ error: 'No match found' });
  }
  // Sort by score (best match first)
  results.sort((a, b) => (a.score || 1) - (b.score || 1));
  res.json(results.map(r => r.item));
});

app.get('/api/query', (req, res) => {
  let { q, context } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });
  q = q.trim().toLowerCase();

  console.log('Query received:', q);
  console.log('All names in data:', data.map(p => p.name));

  // 1. Check for day queries
  const day = days.find(d => q.includes(d));
  if (day) {
    const people = findByDay(day);
    return res.json({
      type: 'day',
      day,
      people,
      suggestions: [
        'Ask about a specific professor',
        'Ask about another day',
        'Ask about a department'
      ]
    });
  }

  // 2. Check for department queries
  const dept = departments.find(d => q.includes(d));
  if (dept) {
    const people = findByDepartment(dept);
    return res.json({
      type: 'department',
      department: dept,
      people,
      suggestions: [
        'Ask about a specific professor',
        'Ask about a day',
        'Ask about another department'
      ]
    });
  }

  // 3. Check for name queries
  const nameMatch = q.match(/(professor|dr\.?|mr\.?|ms\.?|mrs\.?|eng\.?|)\s*([a-z\s]+)/i);
  let name = q;
  if (nameMatch && nameMatch[2]) name = nameMatch[2].trim();
  let allMatches = findByName(name);
  console.log('Matches found:', allMatches.map(p => p.name));
  if (allMatches.length > 1) {
    return res.json({
      type: 'multiple',
      people: allMatches,
      suggestions: allMatches.map(p => p.name)
    });
  }
  if (allMatches.length === 1) {
    return res.json({
      type: 'person',
      person: allMatches[0],
      suggestions: [
        'Ask about their office hours on a specific day',
        'Ask about another professor',
        'Ask about their department'
      ]
    });
  }

  // 4. Contextual follow-up (if context is provided)
  if (context) {
    try {
      const ctx = JSON.parse(context);
      if (ctx.type === 'person' && ctx.person && day) {
        // User asked about a day for the last person
        const person = ctx.person;
        const hours = person.office_hours[day.charAt(0).toUpperCase() + day.slice(1)];
        return res.json({
          type: 'person-day',
          person,
          day,
          hours,
          suggestions: [
            'Ask about another day',
            'Ask about another professor'
          ]
        });
      }
    } catch {}
  }

  // 5. Fallback
  return res.status(404).json({ error: 'Sorry, I could not understand your question.' });
});

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
console.log('Backend updated!');
