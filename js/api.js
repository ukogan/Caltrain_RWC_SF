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
            
            // For now, just log that we got data and return null
            // TODO: Parse protobuf data
            const buffer = await response.arrayBuffer();
            console.log('GTFS-RT data received, bytes:', buffer.byteLength);
            
            // Return null for now - will implement parsing next
            return null;
            
        } catch (error) {
            console.error('Live data fetch failed:', error);
            return null;
        }
    }

    async getRwcToSfTrains() {
        try {
            // First try live data
            const liveData = await this.fetchLiveData();
            if (liveData && liveData.rwcToSf) {
                console.log('Using live GTFS-RT data for RWC to SF');
                return liveData.rwcToSf;
            }
            
            // Fall back to static data
            const data = await this.loadScheduleData();
            console.log('Using static schedule data for RWC to SF');
            return data.rwcToSf || [];
        } catch (error) {
            console.error('Error fetching RWC to SF trains:', error);
            console.log('Using mock data for RWC to SF');
            return this.getMockRwcToSfData();
        }
    }

    async getSfToRwcTrains() {
        try {
            // First try live data
            const liveData = await this.fetchLiveData();
            if (liveData && liveData.sfToRwc) {
                console.log('Using live GTFS-RT data for SF to RWC');
                return liveData.sfToRwc;
            }
            
            // Fall back to static data
            const data = await this.loadScheduleData();
            console.log('Using static schedule data for SF to RWC');
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