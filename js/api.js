class CaltrainAPI {
    constructor() {
        this.scheduleData = null;
        this.staticGTFSData = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.staticCacheTimeout = 24 * 60 * 60 * 1000; // 24 hours for static data
        this.apiKey = '1710b328-a1aa-483f-8eed-9c59d865acce';
        this.baseUrl = 'https://api.511.org/transit';
        this.lastStaticFetch = null;
    }

    async loadScheduleData() {
        if (this.scheduleData) {
            return this.scheduleData;
        }

        try {
            const response = await fetch('./caltrain-schedules.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.scheduleData = await response.json();
            return this.scheduleData;
        } catch (error) {
            console.error('Error loading schedule data:', error);
            throw error;
        }
    }

    async fetchLiveData() {
        try {
            console.log('Attempting to fetch live GTFS-RT data...');
            
            // Try to fetch trip updates from 511.org
            const url = `${this.baseUrl}/tripupdates?api_key=${this.apiKey}&agency=CT`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/x-protobuf'
                }
            });

            if (!response.ok) {
                throw new Error(`GTFS-RT API error: ${response.status} ${response.statusText}`);
            }

            console.log('GTFS-RT response received, size:', response.headers.get('content-length'));
            
            const buffer = await response.arrayBuffer();
            console.log('GTFS-RT data received, bytes:', buffer.byteLength);
            
            // Parse the protobuf data
            const parsedData = await this.parseGTFSRealtime(buffer);
            if (parsedData) {
                console.log('Successfully parsed GTFS-RT data');
                return parsedData;
            }
            
            return null;
            
        } catch (error) {
            console.error('Live data fetch failed:', error);
            return null;
        }
    }

    async parseGTFSRealtime(buffer) {
        try {
            // Simple GTFS-RT schema definition for protobuf.js
            const GTFSRealtimeSchema = {
                "nested": {
                    "transit_realtime": {
                        "nested": {
                            "FeedMessage": {
                                "fields": {
                                    "header": {"rule": "required", "type": "FeedHeader", "id": 1},
                                    "entity": {"rule": "repeated", "type": "FeedEntity", "id": 2}
                                }
                            },
                            "FeedHeader": {
                                "fields": {
                                    "gtfsRealtimeVersion": {"rule": "required", "type": "string", "id": 1},
                                    "timestamp": {"type": "uint64", "id": 3}
                                }
                            },
                            "FeedEntity": {
                                "fields": {
                                    "id": {"rule": "required", "type": "string", "id": 1},
                                    "tripUpdate": {"type": "TripUpdate", "id": 3}
                                }
                            },
                            "TripUpdate": {
                                "fields": {
                                    "trip": {"rule": "required", "type": "TripDescriptor", "id": 1},
                                    "stopTimeUpdate": {"rule": "repeated", "type": "StopTimeUpdate", "id": 2}
                                }
                            },
                            "TripDescriptor": {
                                "fields": {
                                    "tripId": {"type": "string", "id": 1},
                                    "routeId": {"type": "string", "id": 5},
                                    "directionId": {"type": "uint32", "id": 6},
                                    "startTime": {"type": "string", "id": 2}
                                }
                            },
                            "StopTimeUpdate": {
                                "fields": {
                                    "stopSequence": {"type": "uint32", "id": 1},
                                    "stopId": {"type": "string", "id": 4},
                                    "arrival": {"type": "StopTimeEvent", "id": 2},
                                    "departure": {"type": "StopTimeEvent", "id": 3}
                                }
                            },
                            "StopTimeEvent": {
                                "fields": {
                                    "time": {"type": "int64", "id": 1},
                                    "delay": {"type": "int32", "id": 2}
                                }
                            }
                        }
                    }
                }
            };

            // Load the schema and decode
            const root = protobuf.Root.fromJSON(GTFSRealtimeSchema);
            const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
            
            const message = FeedMessage.decode(new Uint8Array(buffer));
            const object = FeedMessage.toObject(message, {
                longs: String,
                enums: String,
                bytes: String,
            });

            console.log('Parsed GTFS-RT feed with', object.entity?.length || 0, 'entities');
            
            // Convert to our format
            return this.convertGTFSToOurFormat(object);
            
        } catch (error) {
            console.error('Failed to parse GTFS-RT data:', error);
            return null;
        }
    }

    convertGTFSToOurFormat(gtfsData) {
        try {
            const rwcToSf = [];
            const sfToRwc = [];
            
            // Known station IDs for Redwood City and SF King Street
            const REDWOOD_CITY_STOP_ID = '70212'; // Redwood City
            const SF_KING_ST_STOP_ID = '70011';   // San Francisco (King St / 4th St)
            
            if (!gtfsData.entity) {
                console.warn('No entities in GTFS-RT data');
                return { rwcToSf, sfToRwc };
            }

            gtfsData.entity.forEach(entity => {
                if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) {
                    return;
                }

                const trip = entity.tripUpdate.trip;
                const stopUpdates = entity.tripUpdate.stopTimeUpdate;
                
                // Find stops for our stations
                let rwcStop = null;
                let sfStop = null;
                
                stopUpdates.forEach(stopUpdate => {
                    if (stopUpdate.stopId === REDWOOD_CITY_STOP_ID) {
                        rwcStop = stopUpdate;
                    } else if (stopUpdate.stopId === SF_KING_ST_STOP_ID) {
                        sfStop = stopUpdate;
                    }
                });

                // If we have both stops, determine direction and create train entry
                if (rwcStop && sfStop) {
                    const rwcTime = this.extractTime(rwcStop);
                    const sfTime = this.extractTime(sfStop);
                    
                    if (rwcTime && sfTime) {
                        const train = {
                            number: trip.tripId || entity.id,
                            type: 'Local', // Could be enhanced by parsing trip data
                            departureTime: '',
                            arrivalTime: '',
                            duration: ''
                        };

                        // Determine direction based on time sequence
                        if (rwcTime < sfTime) {
                            // RWC to SF direction
                            train.departureTime = this.formatTimeFromTimestamp(rwcTime);
                            train.arrivalTime = this.formatTimeFromTimestamp(sfTime);
                            train.duration = this.calculateDuration(rwcTime, sfTime);
                            rwcToSf.push(train);
                        } else {
                            // SF to RWC direction  
                            train.departureTime = this.formatTimeFromTimestamp(sfTime);
                            train.arrivalTime = this.formatTimeFromTimestamp(rwcTime);
                            train.duration = this.calculateDuration(sfTime, rwcTime);
                            sfToRwc.push(train);
                        }
                    }
                }
            });

            // Sort by departure time
            rwcToSf.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
            sfToRwc.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

            console.log(`Converted GTFS-RT data: ${rwcToSf.length} RWC→SF trains, ${sfToRwc.length} SF→RWC trains`);
            
            // Debug: Show some sample train times
            if (rwcToSf.length > 0) {
                console.log('Sample RWC→SF trains:', rwcToSf.slice(0, 3).map(t => `${t.number} at ${t.departureTime}`));
            }
            if (sfToRwc.length > 0) {
                console.log('Sample SF→RWC trains:', sfToRwc.slice(0, 3).map(t => `${t.number} at ${t.departureTime}`));
            }
            
            return { rwcToSf, sfToRwc };
            
        } catch (error) {
            console.error('Error converting GTFS-RT to our format:', error);
            return { rwcToSf: [], sfToRwc: [] };
        }
    }

    extractTime(stopUpdate) {
        // Try departure first, then arrival
        if (stopUpdate.departure && stopUpdate.departure.time) {
            return parseInt(stopUpdate.departure.time);
        } else if (stopUpdate.arrival && stopUpdate.arrival.time) {
            return parseInt(stopUpdate.arrival.time);
        }
        return null;
    }

    formatTimeFromTimestamp(timestamp) {
        const date = new Date(timestamp * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    calculateDuration(startTimestamp, endTimestamp) {
        const durationMinutes = Math.round((endTimestamp - startTimestamp) / 60);
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        
        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    async fetchStaticGTFS() {
        try {
            // Check if we have cached static data that's less than 24 hours old
            const now = Date.now();
            if (this.staticGTFSData && this.lastStaticFetch && 
                (now - this.lastStaticFetch) < this.staticCacheTimeout) {
                console.log('Using cached static GTFS data');
                return this.staticGTFSData;
            }

            console.log('Fetching fresh static GTFS data from 511.org...');
            
            const url = `${this.baseUrl}/datafeeds?api_key=${this.apiKey}&operator_id=CT`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Static GTFS fetch failed: ${response.status}`);
            }

            const zipBuffer = await response.arrayBuffer();
            console.log('Static GTFS ZIP downloaded, size:', zipBuffer.byteLength);

            // Parse the ZIP file
            const zip = await JSZip.loadAsync(zipBuffer);
            
            // Extract the files we need
            const stopTimesFile = zip.file('stop_times.txt');
            const stopsFile = zip.file('stops.txt');
            const routesFile = zip.file('routes.txt');
            const tripsFile = zip.file('trips.txt');
            
            if (!stopTimesFile || !stopsFile || !routesFile || !tripsFile) {
                throw new Error('Required GTFS files not found in ZIP');
            }

            console.log('Parsing GTFS CSV files...');
            
            // Parse CSV files
            const [stopTimes, stops, routes, trips] = await Promise.all([
                this.parseCSV(await stopTimesFile.async('text')),
                this.parseCSV(await stopsFile.async('text')),
                this.parseCSV(await routesFile.async('text')),
                this.parseCSV(await tripsFile.async('text'))
            ]);

            // Process the data to create our schedule format
            const processedData = this.processGTFSData(stopTimes, stops, routes, trips);
            
            this.staticGTFSData = processedData;
            this.lastStaticFetch = now;
            
            console.log('Static GTFS data processed successfully');
            return processedData;
            
        } catch (error) {
            console.error('Failed to fetch static GTFS data:', error);
            return null;
        }
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.replace(/"/g, '').trim());
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] || '';
            });
            return obj;
        });
    }

    processGTFSData(stopTimes, stops, routes, trips) {
        try {
            console.log('Processing GTFS data...');
            
            // Find Redwood City and SF King Street stop IDs
            const rwcStop = stops.find(stop => 
                stop.stop_name && stop.stop_name.toLowerCase().includes('redwood city')
            );
            const sfStop = stops.find(stop => 
                stop.stop_name && (
                    stop.stop_name.toLowerCase().includes('san francisco') ||
                    stop.stop_name.toLowerCase().includes('king')
                )
            );
            
            if (!rwcStop || !sfStop) {
                console.error('Could not find RWC or SF stops in GTFS data');
                return { rwcToSf: [], sfToRwc: [] };
            }
            
            console.log('Found stops:', rwcStop.stop_name, 'and', sfStop.stop_name);
            
            // Find Caltrain routes (should be route type 2 for rail)
            const caltrainRoutes = routes.filter(route => 
                route.route_type === '2' || route.agency_id === 'caltrain-ca-us'
            );
            
            if (caltrainRoutes.length === 0) {
                console.error('No Caltrain routes found');
                return { rwcToSf: [], sfToRwc: [] };
            }
            
            console.log('Found', caltrainRoutes.length, 'Caltrain routes');
            
            // Get trips for these routes
            const caltrainTrips = trips.filter(trip => 
                caltrainRoutes.some(route => route.route_id === trip.route_id)
            );
            
            console.log('Found', caltrainTrips.length, 'Caltrain trips');
            
            // Process stop times to find trains between RWC and SF
            const rwcToSf = [];
            const sfToRwc = [];
            
            // Group stop times by trip
            const tripStopTimes = {};
            stopTimes.forEach(stopTime => {
                if (!tripStopTimes[stopTime.trip_id]) {
                    tripStopTimes[stopTime.trip_id] = [];
                }
                tripStopTimes[stopTime.trip_id].push(stopTime);
            });
            
            // Process each trip
            caltrainTrips.forEach(trip => {
                const tripStops = tripStopTimes[trip.trip_id];
                if (!tripStops) return;
                
                // Find our stations in this trip
                const rwcStopTime = tripStops.find(st => st.stop_id === rwcStop.stop_id);
                const sfStopTime = tripStops.find(st => st.stop_id === sfStop.stop_id);
                
                if (rwcStopTime && sfStopTime) {
                    // Determine direction based on stop sequence
                    const rwcSequence = parseInt(rwcStopTime.stop_sequence);
                    const sfSequence = parseInt(sfStopTime.stop_sequence);
                    
                    if (rwcSequence < sfSequence) {
                        // RWC to SF
                        rwcToSf.push({
                            number: trip.trip_short_name || trip.trip_id.substring(0, 6),
                            type: 'Local', // Could enhance this
                            departureTime: this.formatGTFSTime(rwcStopTime.departure_time),
                            arrivalTime: this.formatGTFSTime(sfStopTime.arrival_time),
                            duration: this.calculateGTFSDuration(rwcStopTime.departure_time, sfStopTime.arrival_time),
                            tripId: trip.trip_id
                        });
                    } else {
                        // SF to RWC
                        sfToRwc.push({
                            number: trip.trip_short_name || trip.trip_id.substring(0, 6),
                            type: 'Local',
                            departureTime: this.formatGTFSTime(sfStopTime.departure_time),
                            arrivalTime: this.formatGTFSTime(rwcStopTime.arrival_time),
                            duration: this.calculateGTFSDuration(sfStopTime.departure_time, rwcStopTime.arrival_time),
                            tripId: trip.trip_id
                        });
                    }
                }
            });
            
            // Sort by departure time
            rwcToSf.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
            sfToRwc.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
            
            console.log(`Processed static GTFS: ${rwcToSf.length} RWC→SF, ${sfToRwc.length} SF→RWC trains`);
            
            return { rwcToSf, sfToRwc };
            
        } catch (error) {
            console.error('Error processing GTFS data:', error);
            return { rwcToSf: [], sfToRwc: [] };
        }
    }

    formatGTFSTime(timeString) {
        // GTFS time format is HH:MM:SS, we want HH:MM
        if (!timeString) return '';
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
        return timeString;
    }

    calculateGTFSDuration(startTime, endTime) {
        try {
            const [startHour, startMin] = startTime.split(':').map(Number);
            const [endHour, endMin] = endTime.split(':').map(Number);
            
            let startMinutes = startHour * 60 + startMin;
            let endMinutes = endHour * 60 + endMin;
            
            // Handle next day arrivals (GTFS can have times like 25:30)
            if (endMinutes < startMinutes) {
                endMinutes += 24 * 60;
            }
            
            const durationMinutes = endMinutes - startMinutes;
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            
            if (hours === 0) {
                return `${minutes}m`;
            } else if (minutes === 0) {
                return `${hours}h`;
            } else {
                return `${hours}h ${minutes}m`;
            }
        } catch (error) {
            return 'N/A';
        }
    }

    async getRwcToSfTrains(forTomorrow = false) {
        try {
            // Always get static schedule as base
            const staticData = await this.fetchStaticGTFS();
            
            if (!staticData || !staticData.rwcToSf) {
                console.log('Static GTFS failed, falling back to local JSON for RWC to SF');
                const fallbackData = await this.loadScheduleData();
                return fallbackData.rwcToSf || this.getMockRwcToSfData();
            }

            // For tomorrow, just return static data
            if (forTomorrow) {
                console.log('Using static GTFS data for RWC to SF (tomorrow)');
                return staticData.rwcToSf;
            }
            
            // For today, merge with real-time updates
            console.log('Merging static GTFS with real-time updates for RWC to SF (today)');
            const mergedData = await this.mergeWithRealtime(staticData.rwcToSf, 'rwcToSf');
            return mergedData;
            
        } catch (error) {
            console.error('Error in hybrid data fetch for RWC to SF:', error);
            console.log('Using mock data for RWC to SF');
            return this.getMockRwcToSfData();
        }
    }

    async getSfToRwcTrains(forTomorrow = false) {
        try {
            // Always get static schedule as base
            const staticData = await this.fetchStaticGTFS();
            
            if (!staticData || !staticData.sfToRwc) {
                console.log('Static GTFS failed, falling back to local JSON for SF to RWC');
                const fallbackData = await this.loadScheduleData();
                return fallbackData.sfToRwc || this.getMockSfToRwcData();
            }

            // For tomorrow, just return static data
            if (forTomorrow) {
                console.log('Using static GTFS data for SF to RWC (tomorrow)');
                return staticData.sfToRwc;
            }
            
            // For today, merge with real-time updates
            console.log('Merging static GTFS with real-time updates for SF to RWC (today)');
            const mergedData = await this.mergeWithRealtime(staticData.sfToRwc, 'sfToRwc');
            return mergedData;
            
        } catch (error) {
            console.error('Error in hybrid data fetch for SF to RWC:', error);
            console.log('Using mock data for SF to RWC');
            return this.getMockSfToRwcData();
        }
    }

    async mergeWithRealtime(staticTrains, direction) {
        try {
            // Get real-time updates
            const realtimeData = await this.fetchLiveData();
            
            if (!realtimeData || (!realtimeData.rwcToSf && !realtimeData.sfToRwc)) {
                console.log('No real-time data available, using static schedule only');
                return staticTrains;
            }
            
            const realtimeTrains = direction === 'rwcToSf' ? realtimeData.rwcToSf : realtimeData.sfToRwc;
            
            if (!realtimeTrains || realtimeTrains.length === 0) {
                console.log(`No real-time data for ${direction}, using static schedule only`);
                return staticTrains;
            }
            
            console.log(`Applying real-time updates to ${staticTrains.length} static trains`);
            
            // Create a map of real-time updates by trip ID
            const realtimeMap = new Map();
            realtimeTrains.forEach(rt => {
                if (rt.tripId) {
                    realtimeMap.set(rt.tripId, rt);
                }
            });
            
            // Apply real-time updates to static trains
            const mergedTrains = staticTrains.map(staticTrain => {
                const realtimeUpdate = realtimeMap.get(staticTrain.tripId);
                
                if (realtimeUpdate) {
                    // Use real-time times if available
                    return {
                        ...staticTrain,
                        departureTime: realtimeUpdate.departureTime || staticTrain.departureTime,
                        arrivalTime: realtimeUpdate.arrivalTime || staticTrain.arrivalTime,
                        duration: realtimeUpdate.duration || staticTrain.duration,
                        isRealtime: true
                    };
                }
                
                // No real-time update, use static
                return {
                    ...staticTrain,
                    isRealtime: false
                };
            });
            
            console.log(`Merged data: ${mergedTrains.filter(t => t.isRealtime).length} trains with real-time updates`);
            return mergedTrains;
            
        } catch (error) {
            console.error('Error merging real-time data:', error);
            return staticTrains;
        }
    }


    getMockRwcToSfData() {
        console.warn('Using mock RWC to SF data - API unavailable');
        return [
            // Early morning
            { number: '152', type: 'Local', departureTime: '06:15', arrivalTime: '07:25', duration: '1h 10m' },
            { number: '254', type: 'Limited', departureTime: '06:45', arrivalTime: '07:48', duration: '1h 3m' },
            { number: '156', type: 'Local', departureTime: '07:15', arrivalTime: '08:25', duration: '1h 10m' },
            { number: '258', type: 'Limited', departureTime: '07:45', arrivalTime: '08:48', duration: '1h 3m' },
            { number: '160', type: 'Local', departureTime: '08:15', arrivalTime: '09:25', duration: '1h 10m' },
            { number: '262', type: 'Limited', departureTime: '08:45', arrivalTime: '09:48', duration: '1h 3m' },
            // Mid-morning
            { number: '164', type: 'Local', departureTime: '09:15', arrivalTime: '10:25', duration: '1h 10m' },
            { number: '266', type: 'Limited', departureTime: '09:45', arrivalTime: '10:48', duration: '1h 3m' },
            { number: '168', type: 'Local', departureTime: '10:15', arrivalTime: '11:25', duration: '1h 10m' },
            { number: '270', type: 'Limited', departureTime: '10:45', arrivalTime: '11:48', duration: '1h 3m' },
            // Late morning/noon
            { number: '172', type: 'Local', departureTime: '11:15', arrivalTime: '12:25', duration: '1h 10m' },
            { number: '274', type: 'Limited', departureTime: '11:45', arrivalTime: '12:48', duration: '1h 3m' },
            { number: '176', type: 'Local', departureTime: '12:15', arrivalTime: '13:25', duration: '1h 10m' },
            { number: '278', type: 'Limited', departureTime: '12:45', arrivalTime: '13:48', duration: '1h 3m' },
            // Afternoon
            { number: '180', type: 'Local', departureTime: '13:15', arrivalTime: '14:25', duration: '1h 10m' },
            { number: '282', type: 'Limited', departureTime: '13:45', arrivalTime: '14:48', duration: '1h 3m' },
            { number: '184', type: 'Local', departureTime: '14:15', arrivalTime: '15:25', duration: '1h 10m' },
            { number: '286', type: 'Limited', departureTime: '14:45', arrivalTime: '15:48', duration: '1h 3m' },
            { number: '188', type: 'Local', departureTime: '15:15', arrivalTime: '16:25', duration: '1h 10m' },
            { number: '290', type: 'Limited', departureTime: '15:45', arrivalTime: '16:48', duration: '1h 3m' },
            // Evening
            { number: '192', type: 'Local', departureTime: '16:15', arrivalTime: '17:25', duration: '1h 10m' },
            { number: '294', type: 'Limited', departureTime: '16:45', arrivalTime: '17:48', duration: '1h 3m' },
            { number: '196', type: 'Local', departureTime: '17:15', arrivalTime: '18:25', duration: '1h 10m' },
            { number: '298', type: 'Limited', departureTime: '17:45', arrivalTime: '18:48', duration: '1h 3m' },
            { number: '200', type: 'Local', departureTime: '18:15', arrivalTime: '19:25', duration: '1h 10m' },
            { number: '202', type: 'Limited', departureTime: '18:45', arrivalTime: '19:48', duration: '1h 3m' },
            // Night
            { number: '204', type: 'Local', departureTime: '19:15', arrivalTime: '20:25', duration: '1h 10m' },
            { number: '206', type: 'Limited', departureTime: '19:45', arrivalTime: '20:48', duration: '1h 3m' },
            { number: '208', type: 'Local', departureTime: '20:15', arrivalTime: '21:25', duration: '1h 10m' },
            { number: '210', type: 'Limited', departureTime: '20:45', arrivalTime: '21:48', duration: '1h 3m' }
        ];
    }

    getMockSfToRwcData() {
        console.warn('Using mock SF to RWC data - API unavailable');
        return [
            // Early morning
            { number: '153', type: 'Local', departureTime: '06:12', arrivalTime: '07:22', duration: '1h 10m' },
            { number: '255', type: 'Limited', departureTime: '06:42', arrivalTime: '07:45', duration: '1h 3m' },
            { number: '157', type: 'Local', departureTime: '07:12', arrivalTime: '08:22', duration: '1h 10m' },
            { number: '259', type: 'Limited', departureTime: '07:42', arrivalTime: '08:45', duration: '1h 3m' },
            { number: '161', type: 'Local', departureTime: '08:12', arrivalTime: '09:22', duration: '1h 10m' },
            { number: '263', type: 'Limited', departureTime: '08:42', arrivalTime: '09:45', duration: '1h 3m' },
            // Mid-morning
            { number: '165', type: 'Local', departureTime: '09:12', arrivalTime: '10:22', duration: '1h 10m' },
            { number: '267', type: 'Limited', departureTime: '09:42', arrivalTime: '10:45', duration: '1h 3m' },
            { number: '169', type: 'Local', departureTime: '10:12', arrivalTime: '11:22', duration: '1h 10m' },
            { number: '271', type: 'Limited', departureTime: '10:42', arrivalTime: '11:45', duration: '1h 3m' },
            // Late morning/noon
            { number: '173', type: 'Local', departureTime: '11:12', arrivalTime: '12:22', duration: '1h 10m' },
            { number: '275', type: 'Limited', departureTime: '11:42', arrivalTime: '12:45', duration: '1h 3m' },
            { number: '177', type: 'Local', departureTime: '12:12', arrivalTime: '13:22', duration: '1h 10m' },
            { number: '279', type: 'Limited', departureTime: '12:42', arrivalTime: '13:45', duration: '1h 3m' },
            // Afternoon
            { number: '181', type: 'Local', departureTime: '13:12', arrivalTime: '14:22', duration: '1h 10m' },
            { number: '283', type: 'Limited', departureTime: '13:42', arrivalTime: '14:45', duration: '1h 3m' },
            { number: '185', type: 'Local', departureTime: '14:12', arrivalTime: '15:22', duration: '1h 10m' },
            { number: '287', type: 'Limited', departureTime: '14:42', arrivalTime: '15:45', duration: '1h 3m' },
            { number: '189', type: 'Local', departureTime: '15:12', arrivalTime: '16:22', duration: '1h 10m' },
            { number: '291', type: 'Limited', departureTime: '15:42', arrivalTime: '16:45', duration: '1h 3m' },
            // Peak evening
            { number: '193', type: 'Local', departureTime: '16:12', arrivalTime: '17:22', duration: '1h 10m' },
            { number: '295', type: 'Limited', departureTime: '16:42', arrivalTime: '17:45', duration: '1h 3m' },
            { number: '197', type: 'Local', departureTime: '17:12', arrivalTime: '18:22', duration: '1h 10m' },
            { number: '299', type: 'Limited', departureTime: '17:42', arrivalTime: '18:45', duration: '1h 3m' },
            { number: '201', type: 'Local', departureTime: '18:12', arrivalTime: '19:22', duration: '1h 10m' },
            { number: '203', type: 'Limited', departureTime: '18:42', arrivalTime: '19:45', duration: '1h 3m' },
            // Night
            { number: '205', type: 'Local', departureTime: '19:12', arrivalTime: '20:22', duration: '1h 10m' },
            { number: '207', type: 'Limited', departureTime: '19:42', arrivalTime: '20:45', duration: '1h 3m' },
            { number: '209', type: 'Local', departureTime: '20:12', arrivalTime: '21:22', duration: '1h 10m' },
            { number: '211', type: 'Limited', departureTime: '20:42', arrivalTime: '21:45', duration: '1h 3m' }
        ];
    }
}