require("dotenv").config();

const aiService = require("../src/backend/services/aiService");

const samples = [
  { question: "Cila eshte green flag me e forte ne takim?", answer: "Kur degjon me vemendje dhe nuk ben show.", timeMode: "5s" },
  { question: "Cfare e ben nje shok te rreme?", answer: "Te kerkon vetem kur ka hall.", timeMode: "5s" },
  { question: "Cili eshte sekreti yt i vogel toksik?", answer: "Lexoj mesazhin dhe pergjigjem pas 4 oresh.", timeMode: "10s" },
  { question: "Kur e kupton qe je ne faze glow up?", answer: "Kur nuk kerkon me validim nga askush.", timeMode: "5s" },
  { question: "Cfare sdo falje kurre ne lidhje?", answer: "Genjeshtren e qete ne sy.", timeMode: "5s" },
  { question: "Cfare te ben te dukshem online?", answer: "Te flasesh si njeri, jo si brand i lodhur.", timeMode: "10s" },
  { question: "Cili eshte red flag qe njerezit e normalizojne?", answer: "Tallja konstante e maskuar si humor.", timeMode: "5s" },
  { question: "Cila fjale te ben weak direkt?", answer: "Do shohim.", timeMode: "5s" },
  { question: "Cfare e ben nje pergjigje virale?", answer: "Pak te vertete, pak tension, zero filter.", timeMode: "10s" },
  { question: "Cfare mendimi ke qe ndez debat?", answer: "Jo cdo honesty eshte maturity.", timeMode: "5s" },
];

const run = async () => {
  console.log("AI batch comment test");
  console.log("Samples:", samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const [comment, sentiment] = await Promise.all([
      aiService.generateAICommentPayload(sample),
      aiService.analyzeSentiment(sample),
    ]);

    console.log(`\n#${index + 1}`);
    console.log("Question:", sample.question);
    console.log("Answer:", sample.answer);
    console.log("Time mode:", sample.timeMode);
    console.log("Comment style:", comment.style);
    console.log("Comment:", comment.comment);
    console.log("Sentiment:", sentiment);
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Batch AI comment test failed:", error);
    process.exit(1);
  });
