class CaltrainApp {
    constructor() {
        this.api = new CaltrainAPI();
        this.currentView = 'rwcToSf';
        this.currentDay = 'today';
        this.rwcToSfData = null;
        this.sfToRwcData = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.initialize();
    }

    initializeElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            retryBtn: document.getElementById('retryBtn'),
            rwcToSfBtn: document.getElementById('rwcToSfBtn'),
            sfToRwcBtn: document.getElementById('sfToRwcBtn'),
            rwcToSfSchedule: document.getElementById('rwcToSfSchedule'),
            sfToRwcSchedule: document.getElementById('sfToRwcSchedule'),
            rwcToSfTrains: document.getElementById('rwcToSfTrains'),
            sfToRwcTrains: document.getElementById('sfToRwcTrains'),
            lastUpdated: document.getElementById('lastUpdated'),
            todayBtn: document.getElementById('todayBtn'),
            tomorrowBtn: document.getElementById('tomorrowBtn')
        };
    }

    attachEventListeners() {
        this.elements.rwcToSfBtn.addEventListener('click', () => this.showRwcToSfSchedule());
        this.elements.sfToRwcBtn.addEventListener('click', () => this.showSfToRwcSchedule());
        this.elements.retryBtn.addEventListener('click', () => this.loadSchedules());
        this.elements.todayBtn.addEventListener('click', () => this.showTodaySchedule());
        this.elements.tomorrowBtn.addEventListener('click', () => this.showTomorrowSchedule());
    }

    async initialize() {
        // Start with RWC to SF view and today's schedule
        this.showRwcToSfSchedule();
        this.updateRouteInfoText();

        await this.loadSchedules();
        
        // Set up automatic refresh every minute to update time-based filtering
        setInterval(() => {
            this.renderSchedules();
            this.updateLastUpdatedTime();
        }, 60000); // 60 seconds
    }

    async loadSchedules() {
        this.showLoading();
        
        try {
            // Load both directions in parallel
            const [rwcToSfTrains, sfToRwcTrains] = await Promise.all([
                this.api.getRwcToSfTrains(),
                this.api.getSfToRwcTrains()
            ]);

            this.rwcToSfData = rwcToSfTrains;
            this.sfToRwcData = sfToRwcTrains;

            this.renderSchedules();
            this.updateLastUpdatedTime();
            this.hideLoading();

        } catch (error) {
            console.error('Failed to load schedules:', error);
            this.showError();
        }
    }

    renderSchedules() {
        this.renderRwcToSfSchedule();
        this.renderSfToRwcSchedule();
    }

    renderRwcToSfSchedule() {
        if (!this.rwcToSfData) return;

        const tableBody = this.elements.rwcToSfTrains.querySelector('tbody');
        tableBody.innerHTML = '';

        // Filter trains based on current day setting
        const activeTrains = this.currentDay === 'today' 
            ? TimeUtils.filterTrainsByTime(this.rwcToSfData)
            : this.rwcToSfData; // Show all trains for tomorrow

        if (activeTrains.length === 0) {
            const dayText = this.currentDay === 'today' ? 'today' : 'tomorrow';
            tableBody.innerHTML = `<tr><td colspan="3" class="no-trains">No more trains departing ${dayText}</td></tr>`;
            return;
        }

        activeTrains.forEach(train => {
            const trainRow = this.createTrainRow(train);
            tableBody.appendChild(trainRow);
        });
    }

    renderSfToRwcSchedule() {
        if (!this.sfToRwcData) return;

        const tableBody = this.elements.sfToRwcTrains.querySelector('tbody');
        tableBody.innerHTML = '';

        // Filter trains based on current day setting
        const activeTrains = this.currentDay === 'today' 
            ? TimeUtils.filterTrainsByTime(this.sfToRwcData)
            : this.sfToRwcData; // Show all trains for tomorrow

        if (activeTrains.length === 0) {
            const dayText = this.currentDay === 'today' ? 'today' : 'tomorrow';
            tableBody.innerHTML = `<tr><td colspan="3" class="no-trains">No more trains departing ${dayText}</td></tr>`;
            return;
        }

        activeTrains.forEach(train => {
            const trainRow = this.createTrainRow(train);
            tableBody.appendChild(trainRow);
        });
    }

    createTrainRow(train) {
        const row = document.createElement('tr');
        const speedClass = TimeUtils.getSpeedClass(train.duration);
        const isSoon = this.currentDay === 'today' && TimeUtils.isTrainSoon(train.departureTime);
        
        row.className = speedClass;
        if (isSoon) {
            row.classList.add('departing-soon');
        }
        
        row.innerHTML = `
            <td class="departure-time">${TimeUtils.formatTime(train.departureTime)}</td>
            <td class="duration">${train.duration}</td>
            <td class="arrival-time">${TimeUtils.formatTime(train.arrivalTime)}</td>
        `;

        return row;
    }

    showRwcToSfSchedule() {
        this.currentView = 'rwcToSf';
        this.elements.rwcToSfBtn.classList.add('active');
        this.elements.sfToRwcBtn.classList.remove('active');
        this.elements.rwcToSfSchedule.classList.add('active');
        this.elements.sfToRwcSchedule.classList.remove('active');
    }

    showSfToRwcSchedule() {
        this.currentView = 'sfToRwc';
        this.elements.sfToRwcBtn.classList.add('active');
        this.elements.rwcToSfBtn.classList.remove('active');
        this.elements.sfToRwcSchedule.classList.add('active');
        this.elements.rwcToSfSchedule.classList.remove('active');
    }

    showTodaySchedule() {
        this.currentDay = 'today';
        this.elements.todayBtn.classList.add('active');
        this.elements.tomorrowBtn.classList.remove('active');
        this.updateRouteInfoText();
        this.renderSchedules();
    }

    showTomorrowSchedule() {
        this.currentDay = 'tomorrow';
        this.elements.tomorrowBtn.classList.add('active');
        this.elements.todayBtn.classList.remove('active');
        this.updateRouteInfoText();
        this.renderSchedules();
    }

    updateRouteInfoText() {
        const dayText = this.currentDay === 'today' ? 'remaining today' : 'tomorrow';
        const rwcToSfInfo = this.elements.rwcToSfSchedule.querySelector('.route-info');
        const sfToRwcInfo = this.elements.sfToRwcSchedule.querySelector('.route-info');
        
        if (rwcToSfInfo) rwcToSfInfo.textContent = `All trains ${dayText}`;
        if (sfToRwcInfo) sfToRwcInfo.textContent = `All trains ${dayText}`;
    }

    showLoading() {
        this.elements.loading.style.display = 'block';
        this.elements.errorMessage.style.display = 'none';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    showError() {
        this.elements.loading.style.display = 'none';
        this.elements.errorMessage.style.display = 'block';
    }

    updateLastUpdatedTime() {
        this.elements.lastUpdated.textContent = TimeUtils.getFormattedDateTime();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CaltrainApp();
});