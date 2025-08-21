class CaltrainAPI {
    constructor() {
        this.scheduleData = null;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
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

    async getMorningTrains() {
        try {
            const data = await this.loadScheduleData();
            return data.morning || [];
        } catch (error) {
            console.error('Error fetching morning trains:', error);
            return this.getMockMorningData();
        }
    }

    async getAfternoonTrains() {
        try {
            const data = await this.loadScheduleData();
            return data.afternoon || [];
        } catch (error) {
            console.error('Error fetching afternoon trains:', error);
            return this.getMockAfternoonData();
        }
    }


    getMockMorningData() {
        console.warn('Using mock morning data - API unavailable');
        return [
            {
                number: '152',
                type: 'Local',
                departureTime: '06:15',
                arrivalTime: '07:25',
                duration: '1h 10m'
            },
            {
                number: '254',
                type: 'Limited',
                departureTime: '06:45',
                arrivalTime: '07:48',
                duration: '1h 3m'
            },
            {
                number: '156',
                type: 'Local',
                departureTime: '07:15',
                arrivalTime: '08:25',
                duration: '1h 10m'
            },
            {
                number: '258',
                type: 'Limited',
                departureTime: '07:45',
                arrivalTime: '08:48',
                duration: '1h 3m'
            },
            {
                number: '160',
                type: 'Local',
                departureTime: '08:15',
                arrivalTime: '09:25',
                duration: '1h 10m'
            },
            {
                number: '262',
                type: 'Limited',
                departureTime: '08:45',
                arrivalTime: '09:48',
                duration: '1h 3m'
            }
        ];
    }

    getMockAfternoonData() {
        console.warn('Using mock afternoon data - API unavailable');
        return [
            {
                number: '263',
                type: 'Limited',
                departureTime: '16:12',
                arrivalTime: '17:15',
                duration: '1h 3m'
            },
            {
                number: '165',
                type: 'Local',
                departureTime: '16:35',
                arrivalTime: '17:45',
                duration: '1h 10m'
            },
            {
                number: '267',
                type: 'Limited',
                departureTime: '17:12',
                arrivalTime: '18:15',
                duration: '1h 3m'
            },
            {
                number: '169',
                type: 'Local',
                departureTime: '17:35',
                arrivalTime: '18:45',
                duration: '1h 10m'
            },
            {
                number: '271',
                type: 'Limited',
                departureTime: '18:12',
                arrivalTime: '19:15',
                duration: '1h 3m'
            },
            {
                number: '173',
                type: 'Local',
                departureTime: '18:35',
                arrivalTime: '19:45',
                duration: '1h 10m'
            }
        ];
    }
}