class TimeUtils {
    static getCurrentTime() {
        return new Date();
    }

    static formatTime(timeString) {
        try {
            const time = new Date(`1970-01-01T${timeString}`);
            return time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return timeString;
        }
    }

    static parseTimeToMinutes(timeString) {
        try {
            const [hours, minutes] = timeString.split(':').map(Number);
            return hours * 60 + minutes;
        } catch (e) {
            return 0;
        }
    }

    static calculateDuration(departureTime, arrivalTime) {
        const depMinutes = this.parseTimeToMinutes(departureTime);
        const arrMinutes = this.parseTimeToMinutes(arrivalTime);
        
        let duration = arrMinutes - depMinutes;
        if (duration < 0) {
            duration += 24 * 60; // Handle next day arrival
        }
        
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        
        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    static isInTimeRange(timeString, startTime, endTime) {
        const minutes = this.parseTimeToMinutes(timeString);
        const startMinutes = this.parseTimeToMinutes(startTime);
        const endMinutes = this.parseTimeToMinutes(endTime);
        
        return minutes >= startMinutes && minutes <= endMinutes;
    }

    static getCurrentPeriod() {
        const now = new Date();
        const hours = now.getHours();
        
        if (hours >= 6 && hours < 12) {
            return 'morning';
        } else if (hours >= 16 && hours < 20) {
            return 'afternoon';
        } else {
            // Default to morning for other times
            return 'morning';
        }
    }

    static getFormattedDate() {
        const now = new Date();
        return now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static getFormattedDateTime() {
        const now = new Date();
        return now.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    static getSpeedClass(duration) {
        // Parse duration string (e.g., "35m", "1h 10m") to minutes
        let minutes = 0;
        
        if (duration.includes('h')) {
            const parts = duration.split('h');
            minutes += parseInt(parts[0]) * 60;
            if (parts[1] && parts[1].trim()) {
                minutes += parseInt(parts[1].replace('m', '').trim());
            }
        } else {
            minutes = parseInt(duration.replace('m', ''));
        }

        // Color coding based on travel time ranges
        if (minutes <= 33) return 'speed-fastest';      // Green - 33 min or less
        else if (minutes <= 34) return 'speed-fast';     // Light green - 34 min  
        else if (minutes <= 35) return 'speed-medium';   // Yellow - 35 min
        else if (minutes <= 41) return 'speed-slow';     // Orange - 36-41 min
        else return 'speed-slowest';                      // Red - 42+ min
    }

    static isTrainPast(departureTime) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const trainDateTime = new Date(`${today}T${departureTime}:00`);
        
        return trainDateTime < now;
    }

    static isTrainSoon(departureTime) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const trainDateTime = new Date(`${today}T${departureTime}:00`);
        
        const timeDiff = trainDateTime - now;
        const minutesDiff = timeDiff / (1000 * 60);
        
        return minutesDiff > 0 && minutesDiff <= 30;
    }

    static filterTrainsByTime(trains) {
        return trains.filter(train => !this.isTrainPast(train.departureTime));
    }
}