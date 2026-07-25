// test_r34.js
const readline = require('readline');

const API_KEY = "5a1faf4cff57900725489c3574871b40899219725b467ed2059b19caf6771c9bf23726a7785b026835ecb39413a6ce9d884f1e8804dde67bd52ae646459ff554";
const USER_ID = "6475331";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Escribe el tag o texto que deseas buscar: ", async (inputTag) => {
    const queryTag = inputTag.trim();
    
    if (!queryTag) {
        console.log("No escribiste nada.");
        rl.close();
        return;
    }

    console.log("\n----------------------------------------");
    console.log(`🧪 Probando Autocompletado para "${queryTag}"...`);
    try {
        const autoUrl = `https://api.rule34.xxx/autocomplete.php?q=${encodeURIComponent(queryTag)}`;
        const resAuto = await fetch(autoUrl);
        const dataAuto = await resAuto.json();
        
        console.log("Resultados de autocomplete:");
        console.log(dataAuto);
    } catch (error) {
        console.error("Error en autocomplete:", error);
    }

    console.log("\n----------------------------------------");
    console.log(`🧪 Buscando Posts para "${queryTag}"...`);
    try {
        const baseUrl = "https://api.rule34.xxx/index.php";
        const params = new URLSearchParams({
            page: "dapi",
            s: "post",
            q: "index",
            json: "1",
            limit: "3",
            tags: queryTag,
            user_id: USER_ID,
            api_key: API_KEY
        });

        const postUrl = `${baseUrl}?${params.toString()}`;
        const resPost = await fetch(postUrl);
        const dataPost = await resPost.json();

        console.log(`Posts encontrados:`);
        if (dataPost && dataPost.length > 0) {
            dataPost.forEach((post, index) => {
                console.log(`[${index + 1}] ID: ${post.id} | URL: ${post.file_url}`);
            });
        } else {
            console.log("No se encontraron posts con ese tag.");
        }
    } catch (error) {
        console.error("Error en la búsqueda de posts:", error);
    }
    console.log("----------------------------------------");
    
    rl.close();
});