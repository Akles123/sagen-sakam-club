import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, updateDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const show = (id,msg,kind="") => { const el=$(id); el.textContent=msg; el.className="status"+(kind?" "+kind:""); };
const hide = id => $(id).classList.add("hidden");
const reveal = id => $(id).classList.remove("hidden");
let app,auth,db,currentUser=null,configReady=false;
const validConfig = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "PASTE_API_KEY_HERE";
if(validConfig){
 try { app=initializeApp(firebaseConfig); auth=getAuth(app); db=getFirestore(app); configReady=true; }
 catch(e){ console.error(e); }
}
function needsSetup(id){show(id,"ऑनलाइन सुविधा शुरू करने के लिए firebase-config.js में Firebase की सही config भरें।","err");}
function niceError(e){console.error(e);const code=e?.code||"";if(code.includes("permission-denied"))return "अनुमति नहीं मिली। Firestore Rules और एडमिन ईमेल जाँचें।";if(code.includes("auth/invalid-credential"))return "ईमेल या पासवर्ड गलत है।";if(code.includes("auth/too-many-requests"))return "बहुत प्रयास हुए हैं। कुछ देर बाद फिर कोशिश करें।";return "काम पूरा नहीं हुआ। इंटरनेट, Firebase config और सुरक्षा नियम जाँचें।";}
function requireConfig(id){if(!configReady){needsSetup(id);return false;}return true;}
function clean(s){return String(s||"").trim();}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
if(!configReady){show("teamMsg","टीम रजिस्ट्रेशन चालू करने के लिए वेबसाइट मालिक को Firebase सेटअप करना होगा।");show("payMsg","भुगतान संदर्भ जमा करने के लिए Firebase सेटअप आवश्यक है।");show("adminMsg","Firebase सेटअप पूरा होने के बाद एडमिन लॉगिन चालू होगा।");}

$("teamForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!requireConfig("teamMsg"))return;
 const data={teamName:clean($("teamName").value),captain:clean($("captain").value),phone:clean($("teamPhone").value),village:clean($("village").value),note:clean($("teamNote").value),status:"pending",createdAt:serverTimestamp()};
 try{await addDoc(collection(db,"teams"),data);show("teamMsg","टीम एंट्री भेज दी गई है। यह अभी लंबित है; सीट पक्की करने के लिए आयोजक की पुष्टि जरूरी है।","ok");e.target.reset();}
 catch(err){show("teamMsg",niceError(err),"err");}
});
$("payForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!requireConfig("payMsg"))return;
 const data={teamName:clean($("payTeam").value),phone:clean($("payPhone").value),amount:Number($("payAmount").value),utr:clean($("utr").value),status:"pending",createdAt:serverTimestamp()};
 try{await addDoc(collection(db,"payments"),data);show("payMsg","भुगतान विवरण जमा हो गया। भुगतान की पुष्टि एडमिन UPI ऐप/बैंक में जाँचकर करेगा।","ok");e.target.reset();}
 catch(err){show("payMsg",niceError(err),"err");}
});
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!requireConfig("adminMsg"))return;
 try{await signInWithEmailAndPassword(auth,clean($("adminEmail").value),$("adminPassword").value);}
 catch(err){show("adminMsg",niceError(err),"err");}
});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
if(configReady) onAuthStateChanged(auth,async user=>{
 currentUser=user;
 if(!user){hide("adminArea");hide("logoutBtn");return;}
 if(!ADMIN_EMAIL || user.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase()){
  show("adminMsg","यह अकाउंट एडमिन ईमेल नहीं है। सुरक्षा के लिए लॉगआउट किया जा रहा है।","err");await signOut(auth);return;
 }
 reveal("adminArea");reveal("logoutBtn");show("adminMsg","एडमिन लॉगिन सफल।","ok");await loadAdmin();
});
async function loadAdmin(){
 try{
  const ts=await getDocs(query(collection(db,"teams"),orderBy("createdAt","desc")));
  $("adminTeams").innerHTML=ts.empty?'<div class="item">अभी कोई टीम एंट्री नहीं।</div>':ts.docs.map(d=>{const x=d.data();return `<div class="item"><div class="itemrow"><h4>${esc(x.teamName)}</h4><span class="badge ${x.status==="approved"?"done":"pending"}">${esc(x.status||"pending")}</span></div><p>कप्तान: ${esc(x.captain)} • फोन: ${esc(x.phone)}</p><p>गाँव: ${esc(x.village||"—")} • ${esc(x.note||"")}</p><button class="btn secondary smallbtn" data-team="${d.id}" data-status="approved">एंट्री स्वीकारें</button> <button class="btn secondary smallbtn" data-team="${d.id}" data-status="rejected">अस्वीकारें</button></div>`}).join("");
  $("adminTeams").querySelectorAll("button[data-team]").forEach(b=>b.onclick=async()=>{try{await updateDoc(doc(db,"teams",b.dataset.team),{status:b.dataset.status,reviewedAt:serverTimestamp()});await loadAdmin();}catch(e){show("adminMsg",niceError(e),"err");}});
  const ps=await getDocs(query(collection(db,"payments"),orderBy("createdAt","desc")));
  $("adminPayments").innerHTML=ps.empty?'<div class="item">अभी कोई भुगतान रिकॉर्ड नहीं।</div>':ps.docs.map(d=>{const x=d.data();return `<div class="item"><div class="itemrow"><h4>${esc(x.teamName)} — ₹${esc(x.amount)}</h4><span class="badge ${x.status==="verified"?"done":"pending"}">${esc(x.status||"pending")}</span></div><p>फोन: ${esc(x.phone)} • UTR: <b>${esc(x.utr)}</b></p><p>बैंक/UPI ऐप में जाँच के बाद ही verified करें।</p><button class="btn secondary smallbtn" data-pay="${d.id}" data-status="verified">भुगतान सत्यापित</button> <button class="btn secondary smallbtn" data-pay="${d.id}" data-status="rejected">अस्वीकारें</button></div>`}).join("");
  $("adminPayments").querySelectorAll("button[data-pay]").forEach(b=>b.onclick=async()=>{if(b.dataset.status==="verified"&&!confirm("क्या आपने UPI ऐप/बैंक में UTR और रकम जाँच ली है?"))return;try{await updateDoc(doc(db,"payments",b.dataset.pay),{status:b.dataset.status,reviewedAt:serverTimestamp()});await loadAdmin();}catch(e){show("adminMsg",niceError(e),"err");}});
 }catch(e){show("adminMsg",niceError(e),"err");}
}
$("resultForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser||currentUser.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase())return show("adminMsg","पहले एडमिन लॉगिन करें।","err");
 const data={title:clean($("matchTitle").value),teamA:clean($("sideA").value),scoreA:Number($("scoreA").value),teamB:clean($("sideB").value),scoreB:Number($("scoreB").value),matchDate:clean($("matchDate").value),createdAt:serverTimestamp()};
 try{await addDoc(collection(db,"results"),data);show("adminMsg","रिजल्ट प्रकाशित हो गया।","ok");e.target.reset();await loadResults();}
 catch(err){show("adminMsg",niceError(err),"err");}
});
$("settingsForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!currentUser||currentUser.email?.toLowerCase()!==ADMIN_EMAIL.toLowerCase())return show("adminMsg","पहले एडमिन लॉगिन करें।","err");
 const upi=clean($("upiId").value),name=clean($("upiName").value);
 if(!upi.includes("@")||!name)return show("adminMsg","सही UPI ID (जैसे name@bank) और नाम भरें।","err");
 try{await setDoc(doc(db,"settings","public"),{upiId:upi,upiName:name,updatedAt:serverTimestamp()});show("adminMsg","UPI सेटिंग सेव हो गई।","ok");await loadSettings();}
 catch(err){show("adminMsg",niceError(err),"err");}
});
async function loadResults(){
 if(!configReady)return;
 try{const snap=await getDocs(query(collection(db,"results"),orderBy("createdAt","desc")));$("resultsList").innerHTML=snap.empty?'<div class="item">अभी कोई मैच रिजल्ट प्रकाशित नहीं हुआ है।</div>':snap.docs.map(d=>{const x=d.data();return `<div class="item"><div class="itemrow"><h4>${esc(x.title||"मैच रिजल्ट")}</h4><span class="badge">${esc(x.matchDate||"अपडेट")}</span></div><div class="itemrow"><b>${esc(x.teamA)} <span style="color:var(--gold)">${esc(x.scoreA)}</span> — <span style="color:var(--gold)">${esc(x.scoreB)}</span> ${esc(x.teamB)}</b></div></div>`}).join("");}
 catch(e){$("resultsList").innerHTML='<div class="item">रिजल्ट लोड नहीं हो सके। Firebase Rules/config जाँचें।</div>';}
}
async function loadSettings(){
 if(!configReady)return;
 try{const snap=await getDocs(collection(db,"settings"));const d=snap.docs.find(x=>x.id==="public")?.data();if(!d?.upiId)return;
 $("upiInfo").innerHTML=`UPI ID: <b>${esc(d.upiId)}</b><br>नाम: ${esc(d.upiName)}<br>रकम भेजने से पहले आयोजक से पुष्टि करें।`;
 const url=`upi://pay?pa=${encodeURIComponent(d.upiId)}&pn=${encodeURIComponent(d.upiName)}&am=1000&cu=INR&tn=${encodeURIComponent("Football tournament entry")}`;
 $("upiPayBtn").href=url;reveal("upiPayBtn");
 }catch(e){console.warn(e);}
}
loadResults();loadSettings();
