#!/usr/bin/env python3
"""
Parse Caltrain GTFS data to extract schedules between Redwood City and SF King Street
"""
import csv
import json
from datetime import datetime, time
import sys

def load_csv(filename):
    """Load CSV file and return as list of dictionaries"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f))
    except FileNotFoundError:
        print(f"Error: {filename} not found. Make sure GTFS data is extracted.")
        return []

def get_weekday_service_ids(calendar_data):
    """Get service IDs for weekday service"""
    weekday_services = []
    for service in calendar_data:
        if (service['monday'] == '1' and service['tuesday'] == '1' and 
            service['wednesday'] == '1' and service['thursday'] == '1' and 
            service['friday'] == '1'):
            weekday_services.append(service['service_id'])
    return weekday_services

def parse_time_to_minutes(time_str):
    """Convert HH:MM:SS to minutes since midnight"""
    try:
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1])
        return hours * 60 + minutes
    except:
        return 0

def minutes_to_time_str(minutes):
    """Convert minutes since midnight to HH:MM format"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

def get_route_schedules():
    """Extract schedules for Redwood City <-> SF King Street routes"""
    
    # Load GTFS data
    print("Loading GTFS data...")
    stops = load_csv('stops.txt')
    stop_times = load_csv('stop_times.txt')
    trips = load_csv('trips.txt')
    calendar = load_csv('calendar.txt')
    
    if not all([stops, stop_times, trips, calendar]):
        print("Error: Could not load required GTFS files")
        return None
    
    # Get weekday service IDs
    weekday_services = get_weekday_service_ids(calendar)
    print(f"Weekday services: {weekday_services}")
    
    # Create stop ID lookups
    redwood_city_nb = '70141'  # Northbound (to SF)
    redwood_city_sb = '70142'  # Southbound (from SF)
    sf_king_nb = '70011'       # Northbound platform
    sf_king_sb = '70012'       # Southbound platform
    
    # Get weekday trips
    weekday_trips = []
    for trip in trips:
        if trip['service_id'] in weekday_services:
            weekday_trips.append(trip)
    
    print(f"Found {len(weekday_trips)} weekday trips")
    
    # Create trip lookup
    trip_lookup = {trip['trip_id']: trip for trip in weekday_trips}
    
    morning_trains = []  # RWC -> SF (6-10 AM)
    afternoon_trains = []  # SF -> RWC (4-7 PM)
    
    # Process stop times for our routes
    trip_stops = {}
    for stop_time in stop_times:
        trip_id = stop_time['trip_id']
        if trip_id not in trip_lookup:
            continue
            
        if trip_id not in trip_stops:
            trip_stops[trip_id] = []
        trip_stops[trip_id].append(stop_time)
    
    print(f"Processing {len(trip_stops)} trip schedules...")
    
    # Find trips that go through both stations
    for trip_id, stops_list in trip_stops.items():
        trip_info = trip_lookup[trip_id]
        
        # Create stop lookup for this trip
        trip_stop_lookup = {stop['stop_id']: stop for stop in stops_list}
        
        # Check for morning route: RWC NB -> SF (any platform)
        if redwood_city_nb in trip_stop_lookup:
            rwc_stop = trip_stop_lookup[redwood_city_nb]
            sf_stop = None
            
            # Look for SF stop (prefer NB platform, but accept SB too)
            if sf_king_nb in trip_stop_lookup:
                sf_stop = trip_stop_lookup[sf_king_nb]
            elif sf_king_sb in trip_stop_lookup:
                sf_stop = trip_stop_lookup[sf_king_sb]
            
            if sf_stop:
                dep_minutes = parse_time_to_minutes(rwc_stop['departure_time'])
                arr_minutes = parse_time_to_minutes(sf_stop['arrival_time'])
                
                # Morning trains: 6 AM - 12 PM departures  
                if 360 <= dep_minutes <= 720:  # 6:00 AM to 12:00 PM
                    duration_mins = arr_minutes - dep_minutes
                    if duration_mins < 0:
                        duration_mins += 24 * 60  # Handle next day
                    
                    duration_hours = duration_mins // 60
                    duration_minutes = duration_mins % 60
                    duration_str = f"{duration_hours}h {duration_minutes}m" if duration_hours > 0 else f"{duration_minutes}m"
                    
                    train = {
                        'number': trip_info['trip_short_name'] or trip_id,
                        'type': 'Local',  # Default to Local, could be enhanced
                        'departureTime': minutes_to_time_str(dep_minutes),
                        'arrivalTime': minutes_to_time_str(arr_minutes),
                        'duration': duration_str
                    }
                    morning_trains.append(train)
        
        # Check for afternoon route: SF -> RWC
        if sf_king_sb in trip_stop_lookup:
            sf_stop = trip_stop_lookup[sf_king_sb]
            rwc_stop = None
            
            # Look for RWC stop (prefer SB platform, but accept NB too)
            if redwood_city_sb in trip_stop_lookup:
                rwc_stop = trip_stop_lookup[redwood_city_sb]
            elif redwood_city_nb in trip_stop_lookup:
                rwc_stop = trip_stop_lookup[redwood_city_nb]
            
            if rwc_stop:
                dep_minutes = parse_time_to_minutes(sf_stop['departure_time'])
                arr_minutes = parse_time_to_minutes(rwc_stop['arrival_time'])
                
                # Afternoon trains: 2 PM - 7 PM departures  
                if 840 <= dep_minutes <= 1140:  # 2:00 PM to 7:00 PM
                    duration_mins = arr_minutes - dep_minutes
                    if duration_mins < 0:
                        duration_mins += 24 * 60  # Handle next day
                    
                    duration_hours = duration_mins // 60
                    duration_minutes = duration_mins % 60
                    duration_str = f"{duration_hours}h {duration_minutes}m" if duration_hours > 0 else f"{duration_minutes}m"
                    
                    train = {
                        'number': trip_info['trip_short_name'] or trip_id,
                        'type': 'Local',  # Default to Local
                        'departureTime': minutes_to_time_str(dep_minutes),
                        'arrivalTime': minutes_to_time_str(arr_minutes),
                        'duration': duration_str
                    }
                    afternoon_trains.append(train)
    
    # Sort by departure time
    morning_trains.sort(key=lambda x: parse_time_to_minutes(x['departureTime']))
    afternoon_trains.sort(key=lambda x: parse_time_to_minutes(x['departureTime']))
    
    print(f"Found {len(morning_trains)} morning trains")
    print(f"Found {len(afternoon_trains)} afternoon trains")
    
    return {
        'morning': morning_trains,
        'afternoon': afternoon_trains,
        'lastUpdated': datetime.now().isoformat()
    }

if __name__ == '__main__':
    schedules = get_route_schedules()
    if schedules:
        # Write to JSON file
        with open('caltrain-schedules.json', 'w') as f:
            json.dump(schedules, f, indent=2)
        print("Schedules saved to caltrain-schedules.json")
        
        # Print summary
        print(f"\nMorning trains (RWC -> SF): {len(schedules['morning'])}")
        if schedules['morning']:
            print(f"  First: {schedules['morning'][0]['departureTime']} -> {schedules['morning'][0]['arrivalTime']}")
            print(f"  Last: {schedules['morning'][-1]['departureTime']} -> {schedules['morning'][-1]['arrivalTime']}")
        
        print(f"\nAfternoon trains (SF -> RWC): {len(schedules['afternoon'])}")
        if schedules['afternoon']:
            print(f"  First: {schedules['afternoon'][0]['departureTime']} -> {schedules['afternoon'][0]['arrivalTime']}")
            print(f"  Last: {schedules['afternoon'][-1]['departureTime']} -> {schedules['afternoon'][-1]['arrivalTime']}")
    else:
        print("Failed to parse schedules")
        sys.exit(1)