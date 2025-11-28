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
    var headers = tbl.querySelectorAll("tr.top_title th");
    var dateIdx = 0;
    // Skip the first header if it's the time column (usually empty or different)
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

    /*=== ③ Generate row data by traversing DOM (Optimized) ===*/
    var out = [];

    // Find all course cells/tables. The pattern is that each course slot is a table with ID ending in tblKoma
    // Using querySelectorAll here is acceptable as it runs once
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

        // OPTIMIZATION: Instead of calling querySelector repeatedly,
        // grab all spans and anchors once and iterate.
        var spans = slot.getElementsByTagName("span");
        var anchors = slot.getElementsByTagName("a");

        var periodText = "";
        var dMap = {
            theme: "",
            staff: "",
            room: "",
            note: "",
            opne: ""
        };

        // Single pass over spans to gather all text fields
        for (var k = 0; k < spans.length; k++) {
            var el = spans[k];
            var id = el.id;
            if (!id) continue;

            // Check suffixes. Using indexOf is faster/safer than regex.
            // Logic assumes IDs are unique suffixes within the slot context
            if (id.indexOf("lblPeriod") !== -1) periodText = el.textContent.trim();
            else if (id.indexOf("lblDayTheme") !== -1) dMap.theme = el.textContent.trim();
            else if (id.indexOf("lblStaffNm") !== -1) dMap.staff = el.textContent.trim();
            else if (id.indexOf("lblRoomNm") !== -1) dMap.room = el.textContent.trim();
            else if (id.indexOf("lblNote") !== -1) dMap.note = el.textContent.trim();
            else if (id.indexOf("lblOpneNm") !== -1) dMap.opne = el.textContent.trim();
        }

        if(!periodText) continue;
        var tm = ts(periodText);
        if(!tm[0]) continue;

        var description = [
            dMap.theme,
            dMap.staff,
            dMap.room,
            dMap.note,
            dMap.opne
        ].filter(Boolean).join(" / ");

        // Single pass over anchors to find subjects
        for(var j=0; j<anchors.length; j++){
            var subLink = anchors[j];
            // Identify subject links by ID
            if (subLink.id && subLink.id.indexOf("hlSbjNm") !== -1) {
                var subjectName = subLink.textContent.trim();
                if(!subjectName) continue;

                // Check if this is a secondary (overlapping) class
                // Secondary ID contains "double"
                var isSecondary = subLink.id.indexOf("double") !== -1;

                // Only assign the slot description to the primary class.
                var descToUse = isSecondary ? "" : description;

                out.push({
                    date: date,
                    period: periodText,
                    start: tm[0],
                    end:   tm[1],
                    summary: subjectName,
                    description: descToUse
                });
            }
        }
    }

    finish(out);

  } catch(e){
    finish([]);  /* Ensure completion is called even on exception */
  }
})();
