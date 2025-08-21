# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static webapp displaying Caltrain schedules between Redwood City and SF King Street, showing morning southbound and afternoon northbound trains with travel times.

## Architecture

**Single-Page Application:**
- `index.html` - Main page with embedded structure
- `css/style.css` - Responsive styling with mobile-first approach
- `js/app.js` - Main CaltrainApp class managing UI and data flow
- `js/api.js` - CaltrainAPI class handling data fetching with caching
- `js/utils.js` - TimeUtils class for time calculations and formatting

**API Integration:**
- Primary: Community API at `caltrain-api.thejsj.com/v1/train`
- Fallback: Mock data when API unavailable
- 5-minute client-side caching to minimize requests

**Key Classes:**
- `CaltrainApp` - Main application controller
- `CaltrainAPI` - API integration with caching and fallbacks
- `TimeUtils` - Time parsing, formatting, and calculations

## Development Commands

**Local Testing:**
```bash
python3 -m http.server 8000    # Start local server on port 8000
```

**File Structure:**
```
/
├── index.html          # Main webapp page
├── css/style.css       # Responsive styling
├── js/
│   ├── app.js          # Main application logic  
│   ├── api.js          # API integration
│   └── utils.js        # Time utilities
├── architecture.md     # Technical architecture
└── README.md           # Project documentation
```

## API Endpoints

**Morning Trains (Redwood City → SF):**
- Route: `from=redwood-city&to=san-francisco`
- Time filter: `06:00` to `10:00`

**Afternoon Trains (SF → Redwood City):**
- Route: `from=san-francisco&to=redwood-city`
- Time filter: `16:00` to `19:00`

## Key Implementation Details

**Time Handling:**
- All times processed through `TimeUtils` class
- Duration calculations handle next-day arrivals
- Auto-detection of morning/afternoon based on current time

**Error Handling:**
- API failures gracefully fall back to mock data
- Network errors trigger retry mechanism
- Loading states and error messages for UX

**Responsive Design:**
- CSS Grid for train card layouts
- Mobile-optimized navigation and time displays
- Progressive enhancement approach

## Deployment

Static hosting compatible - no server-side processing required. Can deploy to:
- GitHub Pages
- Netlify
- Vercel
- Any static web server

## Browser Requirements

Modern browsers supporting ES6+, CSS Grid, and Fetch API.