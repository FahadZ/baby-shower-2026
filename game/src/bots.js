// Fake players for rehearsals. They take real avatar slots so a full room
// looks and animates the way it will on the night.
export const BOT_NAMES = [
  "Burpzilla", "NapQueen", "DiaperDan", "SirSpitsAlot", "BinkyBandit", "Lil Snoozer",
  "MilkMonster", "TummyTime", "CribGoblin", "PeekabooPro", "SwaddleSam", "BottleRocket",
  "OnesieOwen", "Pacifiya", "WipeWizard", "BurpCloth", "NightFeed", "ColicKid",
  "GigglesMcGee", "RattleRoy", "TeetherTina", "StrollerSteve", "CarSeatCarl", "BibBoss",
  "LullabyLou", "DrowsyDave", "MobileMaria", "CooCooCal", "BabyBoomer", "PramPam",
  "SippyCupSue", "PlaypenPete", "BouncerBea", "MushyPeas", "TinyToes", "FuzzyFeet",
  "CuddleBug", "HiccupHank", "DroolDrew", "NuzzleNina", "MittensMo", "BlankieBen",
  "SpitUpSid", "DiaperDuty", "BathTimeBo", "RubberDucky", "WobbleWalk", "CrawlerCat",
  "FirstWord", "MamaSaid", "DadaDave", "GrandmaGus", "AuntieAnn", "UncleUmar", "CousinCy",
  "NannyNat", "DoulaDee", "MidwifeMay", "NurseNora", "DocDoris", "LatchLexi", "PumpPat",
  "FormulaFred", "SolidsSal", "PureePaul", "CheerioChe", "BananaBabs", "AvocadoAvi",
  "TeddyTed", "BunnyBri", "LambyLee", "GiraffeGil", "ElephantEl", "LionLiam", "PandaPia",
  "KoalaKai", "OtterOtto", "PuffinPip", "WalrusWes", "NarwhalNed", "YakYara", "ZebraZed"
];

export function botName(i) {
  const base = BOT_NAMES[i % BOT_NAMES.length];
  const n = Math.floor(i / BOT_NAMES.length);
  return n ? base.slice(0, 13) + "#" + (n + 1) : base;
}
