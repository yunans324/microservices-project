function updateDate() {
    const now = new Date();

    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    document.getElementById("day").innerText = days[now.getDay()];
    document.getElementById("date").innerText =
        `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

updateDate();