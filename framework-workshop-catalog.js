import {workshops as core} from './framework-workshops.js';
import {supplementWorkshops} from './framework-supplement-workshops.js';
import {workshopAcceptance} from './framework-workshop-acceptance.js';
export const workshops=[...core,...supplementWorkshops].map(w=>({...w,verification:workshopAcceptance[w.id]?.verification||w.verification}));
