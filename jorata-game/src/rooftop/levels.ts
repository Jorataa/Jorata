export type ObstacleKind = 'slide' | 'vault';
export interface Roof { x:number; y:number; w:number; climb:boolean }
export interface Obstacle { x:number; y:number; w:number; kind:ObstacleKind; id:number }
export interface GuardSpawn { x:number; y:number }
export interface Level { name:string; subtitle:string; theme:string; roofs:Roof[]; obstacles:Obstacle[]; guards:GuardSpawn[]; checkpoints:number[]; end:number; speed:number }
// Each entry is a deliberately placed roof: width, gap before it, elevation, obstacle, guard.
// A 120 Hz simulation validates these same routes; there is no procedural generation.
type Piece = [number,number,number,('slide'|'vault'|'-')?,boolean?];
const routes:Piece[][] = [
 [[1150,0,420,'-'],[1100,130,420,'slide'],[1150,140,420,'-',true],[1050,145,420,'vault'],[1200,130,440,'slide'],[1100,145,420,'-'],[1050,145,420,'vault',true],[1150,150,445,'slide'],[1100,140,420,'-'],[1050,150,420,'vault'],[1200,145,440,'slide',true],[1100,150,420,'-'],[1200,145,420,'vault'],[1150,145,420,'slide'],[1200,150,440,'-',true]],
 [[1100,0,420,'vault'],[1050,135,365,'slide'],[1150,140,420,'-',true],[1100,125,345,'vault'],[1150,140,420,'slide'],[1100,135,355,'-'],[1150,140,420,'vault',true],[1050,125,340,'slide'],[1200,145,425,'-'],[1100,135,365,'vault'],[1150,140,420,'slide',true],[1050,125,340,'-'],[1150,140,420,'vault'],[1100,130,355,'slide'],[1200,145,420,'-',true]],
 [[1100,0,420,'slide'],[1050,140,365,'vault'],[1100,155,420,'-',true],[1050,130,345,'slide'],[1100,155,420,'vault'],[1150,145,380,'-',true],[1050,135,310,'slide'],[1150,155,420,'vault'],[1100,145,365,'-',true],[1050,140,420,'slide'],[1150,130,345,'vault'],[1100,155,420,'-',true],[1050,140,365,'slide'],[1100,150,420,'vault'],[1250,145,390,'-',true]]
];
export const levels:Level[]=routes.map((route,index)=>{
 let x=0; const roofs:Roof[]=[],obstacles:Obstacle[]=[],guards:GuardSpawn[]=[];
 route.forEach(([w,gap,y,kind,guard],i)=>{x+=gap;roofs.push({x,y,w,climb:index>0&&i>0&&y<route[i-1][2]});if(kind&&kind!=='-')obstacles.push({x:x+440,y,w:kind==='slide'?128:96,kind,id:i});if(guard)guards.push({x:x+680,y});x+=w;});
 roofs[0].x-=600;roofs[0].w+=600;
 return {name:['First Escape','High Ground','Last Rooftop'][index],subtitle:['Find your rhythm. Leave the city behind.','Reach higher. Keep your momentum.','One last run to the evacuation point.'][index],theme:['city_day','industrial_district','city_night'][index],roofs,obstacles,guards,checkpoints:[roofs[5].x+130,roofs[10].x+130],end:x-200,speed:270+index*5};
});
export const roofAt=(l:Level,x:number)=>l.roofs.find(r=>x>=r.x&&x<=r.x+r.w);
export function landingClear(l:Level,x:number,y:number,width=34){return !!l.roofs.find(r=>x-width/2>=r.x&&x+width/2<=r.x+r.w&&r.y===y)&&!l.obstacles.some(o=>x+width/2>o.x&&x-width/2<o.x+o.w);}
