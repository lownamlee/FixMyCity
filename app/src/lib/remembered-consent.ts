/** Stores a versioned choice only: never identity images or extracted card data. */
export class RememberedConsent {
  private memory=false;
  private unavailable=false;
  constructor(private readonly key:string,private readonly version:number){}
  accepted():boolean {
    if(this.unavailable)return this.memory;
    try {const saved=JSON.parse(localStorage.getItem(this.key)||'null');return saved?.version===this.version&&saved.accepted===true;}
    catch{return this.memory;}
  }
  accept():void {this.memory=true;try{localStorage.setItem(this.key,JSON.stringify({version:this.version,accepted:true}));}catch{this.unavailable=true;}}
  forget():void {this.memory=false;try{localStorage.removeItem(this.key);}catch{}}
}
