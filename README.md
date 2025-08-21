# Caltrain Schedule Webapp

A simple public webapp that displays today's Caltrain schedules between Redwood City and SF King Street.

## Features

- **Morning Schedule**: Trains from Redwood City to SF King Street (6:00 AM - 10:00 AM)
- **Afternoon Schedule**: Trains from SF King Street to Redwood City (4:00 PM - 7:00 PM)
- **Travel Times**: Shows departure, arrival, and journey duration for each train
- **Color-Coded Speed**: Green (fastest) to red (slowest) based on travel time
- **Real-Time Filtering**: Hides past trains, highlights trains departing in next 30 minutes with **
- **Responsive Design**: Works on desktop and mobile devices
- **Auto-Detection**: Automatically shows relevant schedule based on current time
- **Auto-Refresh**: Updates every minute to maintain current train information

## Usage

### Local Development
1. Clone or download this repository
2. Start a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open http://localhost:8000 in your browser

### Deployment
This is a static webapp that can be hosted on:
- GitHub Pages
- Netlify
- Vercel
- Any web server supporting static files

## Technical Details

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **API**: Uses community Caltrain API with fallback to mock data
- **Caching**: 5-minute client-side cache to reduce API calls
- **Error Handling**: Graceful fallback when API is unavailable

## File Structure
```
/
├── index.html          # Main webapp page
├── css/
│   └── style.css       # Responsive styling
├── js/
│   ├── app.js          # Main application logic
│   ├── api.js          # API integration
│   └── utils.js        # Time utilities
├── architecture.md     # Technical architecture
└── README.md           # This file
```

## Data Sources

- **Primary**: Community Caltrain API (caltrain-api.thejsj.com)
- **Fallback**: Mock schedule data for offline testing

## Browser Support

Modern browsers supporting:
- ES6+ JavaScript features
- CSS Grid and Flexbox
- Fetch API

## License

MIT License - feel free to use and modify as needed.