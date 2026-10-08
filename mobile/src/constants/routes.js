/** Every navigable path in one place, so screens never hard-code route strings. */
export const ROUTES = {
  welcome: '/welcome',
  language: '/language',
  signIn: '/sign-in',
  createAccount: '/create-account',

  villager: {
    home: '/home',
    report: '/report',
    reportDetails: '/report/details',
    chooseVillage: '/report/choose-village',
    confirmation: '/my-reports/confirmation',
    myReports: '/my-reports',
    reportDetail: (id) => `/my-reports/${id}`,
    safety: '/safety',
  },

  liaison: {
    queue: '/queue',
    incident: (id) => `/queue/${id}`,
    verify: (id) => `/queue/${id}/verify`,
    reject: (id) => `/queue/${id}/reject`,
    map: '/map',
    history: '/history',
    profile: '/profile',
  },

  ranger: {
    start: '/start-patrol',
    active: '/active-patrol',
    logIncident: '/log-incident',
    summary: '/patrol-summary',
  },

  demo: { smsSimulator: '/sms-simulator' },
};
