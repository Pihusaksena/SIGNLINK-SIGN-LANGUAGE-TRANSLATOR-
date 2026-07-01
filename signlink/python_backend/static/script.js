// Client-side controller for Flask application dashboard

document.addEventListener("DOMContentLoaded", () => {
    // DOM bindings
    const gestureDisplay = document.getElementById("gesture-name");
    const confidenceDisplay = document.getElementById("gesture-confidence");
    const confidenceBar = document.getElementById("gesture-confidence-bar");
    const sentenceDisplay = document.getElementById("sentence-output");
    
    const btnAppend = document.getElementById("btn-append");
    const btnSpeak = document.getElementById("btn-speak");
    const btnBackspace = document.getElementById("btn-backspace");
    const btnClear = document.getElementById("btn-clear");
    
    const rateSlider = document.getElementById("rate-slider");
    const voiceGender = document.getElementById("voice-gender");

    // Client-side sentence array tracking
    let wordBuffer = [];

    // 1. Establish polling clock for real-time inference sync
    setInterval(async () => {
        try {
            const res = await fetch("/predict");
            if (!res.ok) return;
            const data = await res.json();
            
            // Format results
            if (data && data.gesture) {
                const isSearching = data.gesture === "Searching" || !data.gesture;
                gestureDisplay.textContent = isSearching ? "Analyzing hand..." : data.gesture;
                
                const confidenceVal = (data.confidence * 100).toFixed(1);
                confidenceDisplay.textContent = confidenceVal;
                confidenceBar.style.width = isSearching ? "10%" : `${confidenceVal}%`;
                
                if (isSearching) {
                    confidenceBar.style.backgroundColor = "#475569";
                } else {
                    confidenceBar.style.backgroundColor = "#06b6d4";
                }
            }
        } catch (e) {
            console.warn("Telemetry socket connection retry:", e);
        }
    }, 250);

    // 2. Click Handler - Append current gesture
    btnAppend.addEventListener("click", () => {
        const currentGesture = gestureDisplay.textContent;
        if (currentGesture && currentGesture !== "Analyzing hand..." && currentGesture !== "Searching") {
            wordBuffer.push(currentGesture);
            updateSentenceBox();
        }
    });

    // 3. Click Handler - Backspace
    btnBackspace.addEventListener("click", () => {
        if (wordBuffer.length > 0) {
            wordBuffer.pop();
            updateSentenceBox();
        }
    });

    // 4. Click Handler - Clear
    btnClear.addEventListener("click", async () => {
        wordBuffer = [];
        updateSentenceBox();
        // Notify server
        await fetch("/clear", { method: "POST" });
    });

    // 5. Click Handler - Speak
    btnSpeak.addEventListener("click", async () => {
        const sentenceText = sentenceDisplay.textContent;
        if (!sentenceText || sentenceText === "No words captured yet.") return;

        try {
            await fetch("/speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: sentenceText,
                    rate: parseInt(rateSlider.value) || 160,
                    gender: voiceGender.value
                })
            });
        } catch (e) {
            console.error("Failed to compile speaker request:", e);
        }
    });

    function updateSentenceBox() {
        if (wordBuffer.length === 0) {
            sentenceDisplay.textContent = "No words captured yet.";
            sentenceDisplay.classList.add("empty");
        } else {
            sentenceDisplay.textContent = wordBuffer.join(" ");
            sentenceDisplay.classList.remove("empty");
        }
    }
});
