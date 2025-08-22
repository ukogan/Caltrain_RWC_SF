class CaltrainAPI {
    constructor() {
        this.scheduleData = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.apiKey = '1710b328-a1aa-483f-8eed-9c59d865acce';
        this.baseUrl = 'https://api.511.org/transit';
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

    async getRwcToSfTrains(forTomorrow = false) {
        try {
            // For tomorrow, skip live data and use static schedule
            if (forTomorrow) {
                console.log('Using static schedule data for RWC to SF (tomorrow)');
                const data = await this.loadScheduleData();
                return data.rwcToSf || [];
            }
            
            // For today, try live data first
            const liveData = await this.fetchLiveData();
            if (liveData && liveData.rwcToSf && liveData.rwcToSf.length > 0) {
                console.log('Using live GTFS-RT data for RWC to SF (today)');
                return liveData.rwcToSf;
            }
            
            // Fall back to static data
            const data = await this.loadScheduleData();
            console.log('Using static schedule data for RWC to SF (live data unavailable)');
            return data.rwcToSf || [];
        } catch (error) {
            console.error('Error fetching RWC to SF trains:', error);
            console.log('Using mock data for RWC to SF');
            return this.getMockRwcToSfData();
        }
    }

    async getSfToRwcTrains(forTomorrow = false) {
        try {
            // For tomorrow, skip live data and use static schedule
            if (forTomorrow) {
                console.log('Using static schedule data for SF to RWC (tomorrow)');
                const data = await this.loadScheduleData();
                return data.sfToRwc || [];
            }
            
            // For today, try live data first
            const liveData = await this.fetchLiveData();
            if (liveData && liveData.sfToRwc && liveData.sfToRwc.length > 0) {
                console.log('Using live GTFS-RT data for SF to RWC (today)');
                return liveData.sfToRwc;
            }
            
            // Fall back to static data
            const data = await this.loadScheduleData();
            console.log('Using static schedule data for SF to RWC (live data unavailable)');
            return data.sfToRwc || [];
        } catch (error) {
            console.error('Error fetching SF to RWC trains:', error);
            console.log('Using mock data for SF to RWC');
            return this.getMockSfToRwcData();
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