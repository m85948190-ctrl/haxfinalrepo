(() => {
  // KAI Lite was a retrieval/extractive response lane, not a neural language model.
  // It is intentionally disabled as an answer provider so it cannot replace KAI 51.
  async function respond(){return null;}
  window.HAxBROKaiLite={respond,status:()=>({ready:false,model:'KAI Lite retrieval-only · disabled as answer lane',web:false})};
})();