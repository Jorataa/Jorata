import pack from './pack.json';
export const vehicleNames={sedan_modern:'Modern sedan',sports_coupe:'Sports coupe',suv_offroad:'Off-road SUV',classic_vintage:'Classic vintage',pickup_truck:'Pickup truck',hatchback_compact:'Compact hatchback'};
export const environments={green_highlands:'Green Highlands',alpine:'Alpine Mountains',coastal:'Coastal Drive'};
export const cameras={chase:'Chase',close:'Close chase',cockpit:'Cockpit',cinematic:'Cinematic',free_look:'Free look'};
export type Settings={vehicle:keyof typeof vehicleNames;environment:keyof typeof environments;paint:keyof typeof pack.paints;camera:keyof typeof cameras;weather:keyof typeof pack.weather;time:keyof typeof pack.sky;quality:keyof typeof pack.quality;headlights:boolean;autodrive:boolean};
export const defaults:Settings={vehicle:'sedan_modern',environment:'green_highlands',paint:'forest_green',camera:'chase',weather:'clear',time:'clear_morning',quality:'medium',headlights:false,autodrive:false};
export function loadSettings():Settings{try{const saved=JSON.parse(localStorage.getItem('jorata-endless-drive')||'{}');const s={...defaults};for(const key of Object.keys(defaults) as (keyof Settings)[]){const value=saved[key];const options={vehicle:vehicleNames,environment:environments,paint:pack.paints,camera:cameras,weather:pack.weather,time:pack.sky,quality:pack.quality};if(key==='headlights'||key==='autodrive'){if(typeof value==='boolean')Object.assign(s,{[key]:value});}else if(typeof value==='string'&&value in options[key])Object.assign(s,{[key]:value});}return s;}catch{return {...defaults};}}
export function road(z:number){return {x:18*Math.sin(z/74)+8*Math.sin(z/157),y:2.3*Math.sin(z/90)+.65*Math.sin(z/38),dx:18/74*Math.cos(z/74)+8/157*Math.cos(z/157)};}
export type CarState={x:number;z:number;yaw:number;speed:number;steer:number;distance:number};
export function resetCar(s:CarState){const r=road(s.z);s.x=r.x+1.65;s.yaw=Math.atan(r.dx);s.speed=0;s.steer=0;}
export function simulate(s:CarState,dt:number,input:{throttle:number;steer:number;hardBrake:boolean;auto:boolean},wheelbase:number){
 let steer=input.steer,throttle=input.throttle;
 if(input.auto){const look=8+Math.abs(s.speed)*.7,r=road(s.z-look),dx=r.x+1.65-s.x,dz=-look;const desired=Math.atan2(-dx,-dz),error=Math.atan2(Math.sin(desired-s.yaw),Math.cos(desired-s.yaw));steer=Math.max(-1,Math.min(1,error*3));const curvature=Math.abs(road(s.z-32).dx-road(s.z).dx)/32;const target=Math.min(22,Math.sqrt(1.8/Math.max(.002,curvature)));throttle=s.speed<target?Math.min(1,(target-s.speed)*.5):Math.max(-1,(target-s.speed)*.6);}
 const previous=s.speed;
 if(input.hardBrake)s.speed=Math.sign(s.speed)*Math.max(0,Math.abs(s.speed)-15*dt);
 else if(throttle>0)s.speed+= (s.speed<-.15?9:4.2)*throttle*dt;
 else if(throttle<0)s.speed-=(s.speed>.15?9:2.6)*-throttle*dt;
 else s.speed=Math.sign(s.speed)*Math.max(0,Math.abs(s.speed)-(.22+.008*s.speed*s.speed)*dt);
 if(previous>0&&s.speed<0&&throttle<0)s.speed=0;
 s.speed=Math.max(-7,Math.min(36,s.speed));
 s.steer+=(steer*(.48/(1+Math.abs(s.speed)*.055))-s.steer)*(1-Math.exp(-7*dt));
 s.yaw+=s.speed/wheelbase*Math.tan(s.steer)*dt;
 const distance=s.speed*dt;s.x-=Math.sin(s.yaw)*distance;s.z-=Math.cos(s.yaw)*distance;s.distance+=Math.abs(distance);
 return {distance,acceleration:(s.speed-previous)/dt,brake:input.hardBrake||(throttle<0&&previous>0)};
}
