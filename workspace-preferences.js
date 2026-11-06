/* Update version when publishing a new announcement. */
(function () {
"use strict";
var version="2026-11-03-2", toolbarKey="costbuddy.toolbar.hidden", noticeKey="costbuddy.announcement.dismissed";
var toolbar=document.getElementById("workspaceToolbar"), toggle=document.getElementById("toolbarToggle"), dialog=document.getElementById("announcementDialog"), dismiss=document.getElementById("announcementDismiss");
function read(key) { try { return localStorage.getItem(key); } catch(e) { return null; } }
function save(key,value) { try { localStorage.setItem(key,value); } catch(e) {} }
function setToolbar(hidden) { toolbar.hidden=hidden; toggle.setAttribute("aria-expanded",String(!hidden)); toggle.textContent=hidden ? "展开工具栏" : "收起工具栏"; }
setToolbar(read(toolbarKey)==="true");
toggle.addEventListener("click",function(){ setToolbar(!toolbar.hidden); save(toolbarKey,String(toolbar.hidden)); });
function showNotice(){ dismiss.checked=read(noticeKey)===version; if(!dialog.open) dialog.showModal(); }
function saveNotice(){ save(noticeKey,dismiss.checked ? version : ""); }
function closeNotice(){ saveNotice(); dialog.close(); }
dismiss.addEventListener("change",saveNotice);
document.getElementById("announcementButton").addEventListener("click",showNotice);
document.getElementById("announcementClose").addEventListener("click",closeNotice);
document.getElementById("announcementConfirm").addEventListener("click",closeNotice);
dialog.addEventListener("cancel",saveNotice);
dialog.addEventListener("click",function(e){ if(e.target===dialog) closeNotice(); });
if(read(noticeKey)!==version && !document.querySelector("dialog[open]")) showNotice();
}());

(function () {
  var more = document.getElementById('headerMore');
  if (!more) return;
  document.addEventListener('click', function (event) {
    if (!more.contains(event.target)) more.open = false;
    var button = event.target.closest('button');
    if (button && more.contains(button) && button.id !== 'resetButton') more.open = false;
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && more.open) { more.open = false; more.querySelector('summary').focus(); }
  });
}());

(function(){
  var section=document.getElementById('cnAnnouncementNote'),button=document.getElementById('cnNoteTrigger');
  if (!section || !button) return;
  function setOpen(open){section.classList.toggle('is-open',open);button.setAttribute('aria-expanded',String(open));}
  button.addEventListener('click',function(){setOpen(!section.classList.contains('is-open'));});
  section.addEventListener('mouseenter',function(){if(matchMedia('(hover:hover)').matches)setOpen(true);});
  section.addEventListener('mouseleave',function(){setOpen(false);});
  document.addEventListener('click',function(e){if(!section.contains(e.target))setOpen(false);});
  section.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);button.focus();}});
}());
