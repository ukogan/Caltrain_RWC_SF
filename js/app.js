class CaltrainApp {
    constructor() {
        this.api = new CaltrainAPI();
        this.currentView = 'morning';
        this.morningData = null;
        this.afternoonData = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.initialize();
    }

    initializeElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            retryBtn: document.getElementById('retryBtn'),
            morningBtn: document.getElementById('morningBtn'),
            afternoonBtn: document.getElementById('afternoonBtn'),
            morningSchedule: document.getElementById('morningSchedule'),
            afternoonSchedule: document.getElementById('afternoonSchedule'),
            morningTrains: document.getElementById('morningTrains'),
            afternoonTrains: document.getElementById('afternoonTrains'),
            lastUpdated: document.getElementById('lastUpdated')
        };
    }

    attachEventListeners() {
        this.elements.morningBtn.addEventListener('click', () => this.showMorningSchedule());
        this.elements.afternoonBtn.addEventListener('click', () => this.showAfternoonSchedule());
        this.elements.retryBtn.addEventListener('click', () => this.loadSchedules());
    }

    async initialize() {
        // Set initial view based on current time
        const currentPeriod = TimeUtils.getCurrentPeriod();
        if (currentPeriod === 'afternoon') {
            this.showAfternoonSchedule();
        } else {
            this.showMorningSchedule();
        }

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
            // Load both schedules in parallel
            const [morningTrains, afternoonTrains] = await Promise.all([
                this.api.getMorningTrains(),
                this.api.getAfternoonTrains()
            ]);

            this.morningData = morningTrains;
            this.afternoonData = afternoonTrains;

            this.renderSchedules();
            this.updateLastUpdatedTime();
            this.hideLoading();

        } catch (error) {
            console.error('Failed to load schedules:', error);
            this.showError();
        }
    }

    renderSchedules() {
        this.renderMorningSchedule();
        this.renderAfternoonSchedule();
    }

    renderMorningSchedule() {
        if (!this.morningData) return;

        const tableBody = this.elements.morningTrains.querySelector('tbody');
        tableBody.innerHTML = '';

        // Filter out past trains
        const activeTrains = TimeUtils.filterTrainsByTime(this.morningData);

        if (activeTrains.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="no-trains">No more trains departing today</td></tr>';
            return;
        }

        activeTrains.forEach(train => {
            const trainRow = this.createTrainRow(train);
            tableBody.appendChild(trainRow);
        });
    }

    renderAfternoonSchedule() {
        if (!this.afternoonData) return;

        const tableBody = this.elements.afternoonTrains.querySelector('tbody');
        tableBody.innerHTML = '';

        // Filter out past trains
        const activeTrains = TimeUtils.filterTrainsByTime(this.afternoonData);

        if (activeTrains.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="no-trains">No more trains departing today</td></tr>';
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
        const isSoon = TimeUtils.isTrainSoon(train.departureTime);
        
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

    showMorningSchedule() {
        this.currentView = 'morning';
        this.elements.morningBtn.classList.add('active');
        this.elements.afternoonBtn.classList.remove('active');
        this.elements.morningSchedule.classList.add('active');
        this.elements.afternoonSchedule.classList.remove('active');
    }

    showAfternoonSchedule() {
        this.currentView = 'afternoon';
        this.elements.afternoonBtn.classList.add('active');
        this.elements.morningBtn.classList.remove('active');
        this.elements.afternoonSchedule.classList.add('active');
        this.elements.morningSchedule.classList.remove('active');
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