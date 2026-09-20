const KEY="proteinsnap_v03";
const recipes=[
{id:1,name:"鶏むね肉定食",protein:45,calories:580,fat:15,carbs:65,time:10,tags:["quick"],ingredients:["鶏むね肉 150g","ご飯 150g","サラダ","味噌汁"],steps:["鶏むね肉を焼く","ご飯とサラダを盛る","味噌汁を添える"]},
{id:2,name:"ツナ卵丼",protein:38,calories:520,fat:14,carbs:62,time:8,tags:["quick"],ingredients:["ツナ 1缶","卵 2個","ご飯 150g","醤油 少々"],steps:["卵を溶く","ツナと卵を加熱する","ご飯にのせる"]},
{id:3,name:"プロテイン＋バナナ",protein:27,calories:220,fat:3,carbs:28,time:1,tags:["quick","lowcal","convenience"],ingredients:["プロテイン 1杯","バナナ 1本"],steps:["プロテインを作る","バナナを添える"]},
{id:4,name:"鮭と卵のおにぎりセット",protein:31,calories:460,fat:12,carbs:55,time:5,tags:["quick","convenience"],ingredients:["鮭おにぎり 1個","ゆで卵 2個"],steps:["購入して組み合わせる"]},
{id:5,name:"ギリシャヨーグルト＋プロテイン",protein:35,calories:280,fat:4,carbs:18,time:2,tags:["quick","lowcal","convenience"],ingredients:["ギリシャヨーグルト 1個","プロテイン 1杯"],steps:["ヨーグルトとプロテインを用意する"]},
{id:6,name:"鶏ささみサラダ",protein:30,calories:300,fat:8,carbs:18,time:7,tags:["quick","lowcal"],ingredients:["ささみ 120g","レタス","トマト","ドレッシング"],steps:["ささみを加熱する","野菜と盛り付ける"]}
];
let state=load();
let selectedPhoto=null, selectedFilter="all";
let editingMealId=null;
const nowHour=()=>new Date().getHours();
function mealPeriod(){const h=nowHour();return h<11?"朝":h<15?"昼":h<18?"間食":"夜"}
function todayKey(){return new Date().toISOString().slice(0,10)}
function pfcTotals(){return todayMeals().reduce((a,m)=>({protein:a.protein+Number(m.protein||0),calories:a.calories+Number(m.calories||0),fat:a.fat+Number(m.fat||0),carbs:a.carbs+Number(m.carbs||0)}),{protein:0,calories:0,fat:0,carbs:0})}
function recScore(r,remain,calRemain){
  const proteinGap=Math.abs(r.protein-remain);
  const caloriePenalty=calRemain>0?Math.max(0,r.calories-calRemain)*0.15:Math.max(0,r.calories)*0.08;
  const goalPenalty=state.goalType==="cut"?r.calories*0.04:state.goalType==="bulk"?Math.max(0,remain-r.protein)*0.08:0;
  return proteinGap+caloriePenalty+goalPenalty;
}

function load(){try{const x=JSON.parse(localStorage.getItem(KEY))||{};return {proteinGoal:x.proteinGoal||120,calorieGoal:x.calorieGoal||2500,weight:x.weight||60,goalType:x.goalType||"maintain",apiUrl:x.apiUrl||"",meals:Array.isArray(x.meals)?x.meals:[]}}catch{return {proteinGoal:120,calorieGoal:2500,weight:60,goalType:"maintain",apiUrl:"",meals:[]}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function todayMeals(){const d=new Date().toISOString().slice(0,10);return state.meals.filter(m=>m.date===d)}
function totals(){return todayMeals().reduce((a,m)=>({protein:a.protein+Number(m.protein||0),calories:a.calories+Number(m.calories||0)}),{protein:0,calories:0})}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function go(id){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));document.getElementById(id).classList.add("active");document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.go===id));if(id==="homePage"||id==="recommendPage"||id==="historyPage")renderAll();window.scrollTo(0,0)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-go]");if(b)go(b.dataset.go)});
const photoInput=document.getElementById("photoInput");
photoInput.addEventListener("change",()=>{
 const f=photoInput.files?.[0]; if(!f)return;
 const r=new FileReader();r.onload=()=>{selectedPhoto=r.result;document.getElementById("photoPreview").src=selectedPhoto;document.getElementById("photoPreview").classList.remove("hidden");document.getElementById("photoPlaceholder").classList.add("hidden");document.getElementById("analyzeBtn").disabled=false};r.readAsDataURL(f);
});
document.getElementById("analyzeBtn").addEventListener("click",async()=>{
 const status=document.getElementById("aiStatus"); status.textContent="AI分析中…";
 const remain=Math.max(0,Math.round(state.proteinGoal-totals().protein));
 try{
   const endpoint=(state.apiUrl||"").trim().replace(/\/$/,"")+"/api/analyze-food";
   const api=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:selectedPhoto,remainingProtein:remain,goalType:state.goalType})});
   if(!api.ok) throw new Error("AI endpoint unavailable");
   const data=await api.json();
   if(!data || typeof data.protein !== "number" || typeof data.calories !== "number") throw new Error("invalid response");
   showAnalysis(data,"AI分析（実AI）");
   status.textContent="AI分析が完了しました。数値を確認してから記録してください。";
 }catch(e){
   const demo=remain>=35?{title:"鶏むね肉定食（デモ推定）",items:["鶏むね肉","ご飯","サラダ"],protein:45,calories:580}:{title:"プロテイン＋バナナ（デモ推定）",items:["プロテイン","バナナ"],protein:27,calories:220};
   showAnalysis(demo,"デモ推定");
   status.textContent="本番AI未接続のためデモ推定を表示しています。接続後は自動でAI結果に切り替わります。";
 }
});
function showAnalysis(a,label="AI推定"){
 document.getElementById("analysisCard").classList.remove("hidden");
 document.getElementById("analysisTitle").textContent=a.title;
 document.getElementById("confidence").textContent=label;
 document.getElementById("analysisItems").innerHTML=a.items.map(x=>`<span class="food-chip">${esc(x)}</span>`).join("");
 document.getElementById("proteinInput").value=a.protein;document.getElementById("calorieInput").value=a.calories;document.getElementById("fatInput").value=Number(a.fat||0);document.getElementById("carbsInput").value=Number(a.carbs||0);
}
document.getElementById("saveBtn").addEventListener("click",()=>{
 const name=document.getElementById("analysisTitle").textContent.replace("（AI推定）","")||"食事";
 addMeal(name,document.getElementById("proteinInput").value,document.getElementById("calorieInput").value,document.getElementById("memoInput").value,selectedPhoto,"AI分析",{fat:document.getElementById("fatInput").value,carbs:document.getElementById("carbsInput").value});
 resetRecord();go("homePage");
});
document.getElementById("manualSaveBtn").addEventListener("click",()=>{
 const n=document.getElementById("manualName").value.trim()||"食事";
 addMeal(n,document.getElementById("manualProtein").value,document.getElementById("manualCalories").value,"",null,"手入力");document.getElementById("manualName").value="";go("homePage");
});
function addMeal(name,protein,calories,memo,photo,source,extra={}){
 state.meals.unshift({id:Date.now(),date:todayKey(),time:new Date().toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}),period:mealPeriod(),name,protein:Number(protein)||0,calories:Number(calories)||0,fat:Number(extra.fat||0),carbs:Number(extra.carbs||0),memo,photo,source});
 save()
}
function resetRecord(){selectedPhoto=null;photoInput.value="";document.getElementById("photoPreview").classList.add("hidden");document.getElementById("photoPlaceholder").classList.remove("hidden");document.getElementById("analyzeBtn").disabled=true;document.getElementById("analysisCard").classList.add("hidden");document.getElementById("fatInput").value=0;document.getElementById("carbsInput").value=0}
document.getElementById("filters").addEventListener("click",e=>{const b=e.target.closest(".filter");if(!b)return;selectedFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderRecommendations()});
function renderAll(){renderHome();renderRecommendations();renderHistory();syncSettings()}
function renderHome(){
 const t=totals(), p=pfcTotals(), goal=Number(state.proteinGoal)||120, calGoal=Number(state.calorieGoal)||2500;
 const remain=Math.max(0,goal-t.protein), pct=Math.min(100,t.protein/goal*100);
 document.getElementById("proteinTotal").textContent=Math.round(t.protein*10)/10;
 document.getElementById("proteinGoal").textContent=goal;
 document.getElementById("proteinRemain").textContent=Math.round(remain*10)/10;
 document.getElementById("proteinBar").style.width=pct+"%";
 document.getElementById("mealCount").textContent=todayMeals().length+"食";
 document.getElementById("calorieTotal").textContent=Math.round(p.calories);
 document.getElementById("calorieGoal").textContent=calGoal;
 document.getElementById("pfcProtein").textContent=Math.round(p.protein);
 document.getElementById("pfcFat").textContent=Math.round(p.fat);
 document.getElementById("pfcCarbs").textContent=Math.round(p.carbs);
 const ms=todayMeals();
 document.getElementById("todayMeals").innerHTML=ms.length?ms.map(m=>`<div class="meal-card" data-edit="${m.id}">
  <div><div class="meal-name">${esc(m.name)}</div><div class="meal-meta">${esc(m.period||"")} ${esc(m.time||"")}・${esc(m.source||"")}・${esc(m.calories)}kcal</div></div>
  <div class="meal-protein">+${esc(m.protein)}g</div></div>`).join(""):`<div class="empty">まだ食事がありません。まず1食記録してみましょう。</div>`;
 document.getElementById("homeInsight").textContent=remain<=0?"今日のたんぱく質目標を達成しました。次はカロリーや食事バランスを確認しましょう。":`今は${mealPeriod()}。あと${Math.round(remain)}gです。おすすめから次の1食を選べます。`
}
function renderRecommendations(){
 const t=pfcTotals(), remain=Math.max(0,Number(state.proteinGoal)-t.protein), calRemain=Math.max(0,Number(state.calorieGoal)-t.calories);
 document.getElementById("recommendRemain").textContent=Math.round(remain*10)/10;
 let list=recipes.filter(r=>selectedFilter==="all"||r.tags.includes(selectedFilter));
 list.sort((a,b)=>recScore(a,remain,calRemain)-recScore(b,remain,calRemain));
 document.getElementById("recommendList").innerHTML=list.map((r,i)=>{
   const score=Math.round(recScore(r,remain,calRemain)*10)/10;
   const fit=i===0?"おすすめ":`相性 ${score}`;
   return `<div class="recipe-card" data-recipe="${r.id}">
    <div class="recipe-top"><div><div class="recipe-name">${esc(r.name)}</div>
    <div class="recipe-stats"><span class="recipe-protein">${r.protein}g protein</span><span>${r.calories}kcal</span><span>${r.time}分</span></div></div>
    <div class="recipe-score">${fit}</div></div>
   </div>`
 }).join("")
}

document.getElementById("recommendList").addEventListener("click",e=>{const c=e.target.closest("[data-recipe]");if(c)showRecipe(Number(c.dataset.recipe))});
function showRecipe(id){const r=recipes.find(x=>x.id===id);if(!r)return;document.getElementById("recipeDetail").innerHTML=`<div class="recipe-hero"><h1>${esc(r.name)}</h1><div class="recipe-desc">今のたんぱく質残量に合わせた候補です。</div><div class="recipe-pfc"><div class="pfc"><b>${r.protein}g</b><span>たんぱく質</span></div><div class="pfc"><b>${r.calories}</b><span>kcal</span></div><div class="pfc"><b>${r.time}分</b><span>目安時間</span></div></div><h3>材料</h3><ul>${r.ingredients.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><h3>作り方</h3><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol><button class="primary-btn record-recipe" data-record-recipe="${r.id}">このメニューを記録</button></div>`;go("recipePage")}
document.getElementById("recipePage").addEventListener("click",e=>{const b=e.target.closest("[data-record-recipe]");if(!b)return;const r=recipes.find(x=>x.id===Number(b.dataset.recordRecipe));addMeal(r.name,r.protein,r.calories,"おすすめから記録",null,"おすすめ");go("homePage")});
function renderHistory(){const list=document.getElementById("historyList");if(!state.meals.length){list.innerHTML='<div class="empty">履歴はまだありません。</div>';return}list.innerHTML=state.meals.slice(0,50).map(m=>`<div class="meal-card"><div><div class="meal-name">${esc(m.name)}</div><div class="meal-meta">${esc(m.date)}・${esc(m.source||"")}</div></div><div><div class="meal-protein">+${esc(m.protein)}g</div><div class="meal-meta">${esc(m.calories)}kcal</div></div></div>`).join("")}
document.getElementById("clearHistoryBtn").addEventListener("click",()=>{if(confirm("履歴をすべて削除しますか？")){state.meals=[];save()}});
const editDialog=document.getElementById("editDialog");
document.getElementById("todayMeals").addEventListener("click",e=>{
 const card=e.target.closest("[data-edit]"); if(!card)return;
 const m=state.meals.find(x=>x.id===Number(card.dataset.edit)); if(!m)return;
 document.getElementById("editId").value=m.id; document.getElementById("editName").value=m.name;
 document.getElementById("editProtein").value=m.protein; document.getElementById("editCalories").value=m.calories;
 document.getElementById("editFat").value=m.fat||0; document.getElementById("editCarbs").value=m.carbs||0; editDialog.showModal();
});
document.getElementById("editForm").addEventListener("submit",e=>{
 const id=Number(document.getElementById("editId").value),m=state.meals.find(x=>x.id===id); if(!m)return;
 m.name=document.getElementById("editName").value.trim()||"食事";m.protein=Number(document.getElementById("editProtein").value)||0;m.calories=Number(document.getElementById("editCalories").value)||0;m.fat=Number(document.getElementById("editFat").value)||0;m.carbs=Number(document.getElementById("editCarbs").value)||0;save();
});
document.getElementById("deleteMealBtn").addEventListener("click",()=>{
 const id=Number(document.getElementById("editId").value);state.meals=state.meals.filter(x=>x.id!==id);editDialog.close();save();
});
const dialog=document.getElementById("settingsDialog");
document.getElementById("settingsBtn").addEventListener("click",()=>{syncSettings();dialog.showModal()});
function syncSettings(){document.getElementById("weightInput").value=state.weight||60;document.getElementById("goalType").value=state.goalType||"maintain";document.getElementById("goalInput").value=state.proteinGoal||120;document.getElementById("calGoalInput").value=state.calorieGoal||2500;document.getElementById("apiUrlInput").value=state.apiUrl||""}
document.getElementById("calcGoalBtn").addEventListener("click",()=>{const w=Number(document.getElementById("weightInput").value)||60, g=document.getElementById("goalType").value;const factor=g==="cut"?1.8:g==="bulk"?1.6:1.5;document.getElementById("goalInput").value=Math.round(w*factor);const cal=g==="cut"?w*32:g==="bulk"?w*38:w*35;document.getElementById("calGoalInput").value=Math.round(cal/10)*10});
document.getElementById("settingsForm").addEventListener("submit",()=>{state.weight=Number(document.getElementById("weightInput").value)||60;state.goalType=document.getElementById("goalType").value;state.proteinGoal=Number(document.getElementById("goalInput").value)||120;state.calorieGoal=Number(document.getElementById("calGoalInput").value)||2500;state.apiUrl=document.getElementById("apiUrlInput").value.trim().replace(/\/$/,"");save()});
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
renderAll();