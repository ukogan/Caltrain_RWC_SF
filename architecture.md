# Caltrain Schedule Webapp - Architecture Document

## Project Overview

A simple public webapp that displays today's Caltrain schedules between Redwood City and SF King Street, with morning southbound trains and afternoon northbound return trains, including travel times.

## Features

### Phase 1 (MVP)
1. Display morning trains from Redwood City to SF King Street (6 AM - 10 AM)
2. Display afternoon trains from SF King Street to Redwood City (4 PM - 7 PM)
3. Show departure time, arrival time, and travel duration for each train
4. Responsive design for mobile and desktop viewing

### Phase 2 (Future Enhancement)
1. Real-time status indicators for delayed/cancelled trains
2. Tomorrow's schedule display
3. Additional route options
4. Favorites and notifications

## Technical Architecture

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+) - single-page application
- **API**: Caltrain community API (caltrain-api.thejsj.com) as primary data source
- **Fallback**: Official Caltrain GTFS data if community API unavailable
- **Hosting**: Static hosting (GitHub Pages, Netlify, or similar)

### Data Sources
1. **Primary**: Community Caltrain API (github.com/thejsj/caltrain-api)
   - Endpoint: `http://caltrain-api.thejsj.com/v1/train`
   - Real-time schedule data with JSON responses
   - Station lookup by slug names

2. **Fallback**: Official GTFS Data
   - URL: `https://data.trilliumtransit.com/gtfs/caltrain-ca-us/caltrain-ca-us.zip`
   - Static schedule data requiring local parsing

### Station Identifiers
- **Redwood City**: `redwood-city` (slug)
- **SF King Street**: `san-francisco` (slug)

### Key Components

#### 1. CaltrainAPI Class
- Handles API requests to community API
- Fallback to GTFS parsing if needed
- Caches responses to minimize API calls
- Parses schedule data for specific routes

#### 2. ScheduleDisplay Class  
- Renders morning and afternoon schedules
- Calculates and displays travel times
- Handles time formatting and filtering
- Responsive table/card layout

#### 3. TimeUtils Module
- Current time detection for AM/PM display logic
- Time parsing and formatting functions
- Schedule filtering by time ranges

### File Structure
```
/
├── index.html          # Main webapp page
├── css/
│   └── style.css       # Responsive styling
├── js/
│   ├── app.js          # Main application logic
│   ├── api.js          # API integration
│   └── utils.js        # Time utilities
└── README.md           # Project documentation
```

### API Integration Strategy

**Morning Schedule (6 AM - 10 AM)**
- Query: `from=redwood-city&to=san-francisco&departure_time_after=06:00`
- Filter results for southbound trains

**Afternoon Schedule (4 PM - 7 PM)** 
- Query: `from=san-francisco&to=redwood-city&departure_time_after=16:00&departure_time_before=19:00`
- Filter results for northbound trains

### Error Handling
1. API unavailability - show cached data or fallback message
2. Network errors - retry mechanism with exponential backoff  
3. Invalid data - graceful degradation with partial information
4. Rate limiting - implement client-side caching

### Performance Considerations
- Cache API responses for 5 minutes to reduce requests
- Lazy load schedules only when needed
- Minimize DOM manipulations
- Compress and minify assets for production

## Risk Assessment

### High Risk
- **Community API Reliability**: Third-party API may become unavailable
  - *Mitigation*: Implement GTFS fallback parsing
- **Rate Limiting**: Free API has usage restrictions
  - *Mitigation*: Client-side caching and request throttling

### Medium Risk  
- **Schedule Changes**: Caltrain may update schedules without notice
  - *Mitigation*: Display "last updated" timestamps, daily cache refresh
- **Mobile Performance**: Complex schedule tables on small screens
  - *Mitigation*: Progressive enhancement and responsive design

### Low Risk
- **Browser Compatibility**: Modern JS features may not work on old browsers
  - *Mitigation*: Polyfills for critical features, graceful degradation

## Development Stages

### Stage 1: Core Functionality
- [ ] Basic HTML structure and styling
- [ ] API integration with community endpoint
- [ ] Morning schedule display (Redwood City → SF)
- [ ] Afternoon schedule display (SF → Redwood City)
- [ ] Travel time calculations

### Stage 2: Enhancement & Polish
- [ ] Responsive design optimization
- [ ] Error handling and fallbacks
- [ ] Performance optimization
- [ ] Cross-browser testing

### Stage 3: Future Features (Optional)
- [ ] Real-time status integration
- [ ] Tomorrow's schedule
- [ ] Progressive Web App features
- [ ] User preferences storage

## Architecture Change Counter: 0

*Changes to this document will be tracked here. User review required after 5 changes.*