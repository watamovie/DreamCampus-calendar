(function () {
  /*===== Start and end times for periods 1 to 10 =====*/
  var T = {
    1:["08:50","09:35"], 2:["09:45","10:30"], 3:["10:45","11:30"], 4:["11:40","12:25"],
    5:["13:30","14:15"], 6:["14:25","15:10"], 7:["15:25","16:10"], 8:["16:20","17:05"],
    9:["17:15","18:00"], 10:["18:10","18:55"]
  };

  function finish(r){ completion(JSON.stringify(r)); }

  /*―― Normalize period number ――*/
  function ren(raw){
    var hasB = /^b/i.test(raw);                // Check for 'b' prefix
    var num  = parseInt(raw.replace(/^b/i,''),10);

    /* Correct typos like b3 / b4 → 53 / 54 */
    if(hasB && num < 10){
      num += 50;     // 3 → 53, 4 → 54
      hasB = false;  // No afternoon shift needed
    }

    /* Map 50s / 80s to 1–10 range */
    if(num > 80)      num -= 80;
    else if(num > 50) num -= 50;

    /* If originally had 'b' (afternoon period), add shift of +4 */
    if(hasB) num += 4;

    return num;      // Returns value between 1 and 10
  }

  /*―― Convert period string to [start, end] time ――*/
  function ts(s){
    if(!/時限/.test(s)) return ["",""];
    var p = s.replace(/時限/i,"").split(/[～\-]/),
        a = ren(p[0]), b = ren(p[1] || p[0]);
    return [(T[a]||["",""])[0], (T[b]||["",""])[1]];
  }

  function pad(n){ return (n<10?"0":"")+n; }

  try{
    /*=== ① Retrieve DOM Table ===*/
    var tbl = document.getElementById("ctl00_phContents_ucSchedule_gv");
    if(!tbl) return finish([]);

    /*=== ② Extract month/day from header cells ===*/
    var y = new Date().getFullYear();
    var DAY = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    var datesByDay = {};

    // Use DOM to find headers instead of regex on innerHTML for better reliability
    // Headers are typically in the first row or specifically marked
    var headers = tbl.querySelectorAll("tr.top_title th");
    var dateIdx = 0;
    // Skip the first header if it's the time column (usually empty or different)
    // The regex check ensures we only map columns with dates
    for(var i=0; i<headers.length && dateIdx < 7; i++){
        var txt = headers[i].textContent;
        var m = txt.match(/(\d{1,2})[\/／](\d{1,2})/);
        if(m){
            datesByDay[DAY[dateIdx]] = y+"-"+pad(parseInt(m[1],10))+"-"+pad(parseInt(m[2],10));
            dateIdx++;
        }
    }

    if(dateIdx < 7) return finish([]); // Ensure we found all 7 days

    datesByDay.Fry = datesByDay.Fri;    // Handle typo "Fry" found in some IDs

    /*=== ③ Generate row data by traversing DOM ===*/
    var out = [];

    // Find all course cells/tables. The pattern is that each course slot is a table with ID ending in tblKoma
    var slots = tbl.querySelectorAll("table[id$='tblKoma']");

    for(var i=0; i<slots.length; i++){
        var slot = slots[i];
        var slotId = slot.id;

        // Extract day from the ID (e.g. ..._ucMon_...)
        var dayMatch = slotId.match(/_uc(Mon|Tue|Wed|Thu|Fri|Fry|Sat|Sun)/);
        if(!dayMatch) continue;
        var dayCode = dayMatch[1];
        var date = datesByDay[dayCode];
        if(!date) continue;

        // Extract Period
        var periodEl = slot.querySelector("span[id$='lblPeriod']");
        if(!periodEl) continue;
        var periodText = periodEl.textContent.trim();
        var tm = ts(periodText);
        if(!tm[0]) continue;

        // Extract details. These usually appear once per slot, shared if there's an overlap.
        // We use helper to safely extract text.
        var getVal = function(suffix){
            var el = slot.querySelector("span[id$='" + suffix + "']");
            return el ? el.textContent.trim() : "";
        };

        var description = [
            getVal("lblDayTheme"),
            getVal("lblStaffNm"),
            getVal("lblRoomNm"),
            getVal("lblNote"),
            getVal("lblOpneNm")
        ].filter(Boolean).join(" / ");

        // Find all subjects in this slot.
        // Normal subject: ..._hlSbjNm
        // Overlapping subject: ..._hlSbjNm_double_1, etc.
        // We select all anchor tags whose ID contains 'hlSbjNm'
        var subjectLinks = slot.querySelectorAll("a[id*='hlSbjNm']");

        for(var j=0; j<subjectLinks.length; j++){
            var subLink = subjectLinks[j];
            var subjectName = subLink.textContent.trim();
            if(!subjectName) continue;

            out.push({
                date: date,
                period: periodText,
                start: tm[0],
                end:   tm[1],
                summary: subjectName,
                description: description // Shared description for overlapping classes
            });
        }
    }

    finish(out);

  } catch(e){
    finish([]);  /* Ensure completion is called even on exception */
  }
})();
