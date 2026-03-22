/**
 * Формулы и константы GDD (игрок, survival, экономика, производство, политика, экология).
 */

const VITAL_MAX = 100;
const VITAL_MIN = 0;
const REPUTATION_MIN = -100;
const REPUTATION_MAX = 100;

const SURVIVAL_HUNGER_DECAY_PER_TICK = 0.4;
const SURVIVAL_ACTIVITY_MULT_IDLE = 1;
const SURVIVAL_DAMAGE_WHEN_STARVING = 0.3;

const FOOD_RESTORE_HUNGER = 25;
const FOOD_RESTORE_ENERGY = 5;

const TEMP_IDEAL = 50;
const TEMP_DRIFT = 0.02;

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

/**
 * Efficiency = Energy × Health × (1 - HungerPenalty) — §2.2
 */
function efficiency(energy, health, hunger) {
  const e = clamp(energy / VITAL_MAX, 0, 1);
  const h = clamp(health / VITAL_MAX, 0, 1);
  const hungerPenalty = hunger >= 80 ? 0 : ((80 - hunger) / 80) * 0.5;
  return e * h * (1 - hungerPenalty);
}

/**
 * Pollution ↑ → Efficiency ↓ — §16; болезни снижают множитель.
 */
function efficiencyFull(energy, health, hunger, pollution01 = 0, diseasePenalty = 0) {
  const base = efficiency(energy, health, hunger);
  const eco = clamp(1 - pollution01 * 0.5, 0.1, 1);
  const dis = clamp(1 - diseasePenalty, 0.1, 1);
  return base * eco * dis;
}

/** Resource = Type × Purity × Location × Volume × Depletion — §4.1 */
function resourceValue(typeMul, purity, locationMul, volume, depletion) {
  return typeMul * purity * locationMul * volume * depletion;
}

/** NewVolume = CurrentVolume - ExtractionRate — §4.2 */
function volumeAfterExtraction(current, rate) {
  return Math.max(0, current - rate);
}

/** Output = Input × MachineEfficiency × Time — §5.1 */
function productionOutput(inputQty, machineEfficiency, timeFactor) {
  return inputQty * machineEfficiency * timeFactor;
}

/** Q = MaterialQuality × MachineLevel × Precision — §5.2 */
function quality(materialQ, machineLevel, precision) {
  return materialQ * machineLevel * precision;
}

/** Building = Type × Tier × Condition × Connections — §6.1 */
function buildingFactor(typeMul, tier, condition, connectionsMul) {
  return typeMul * tier * condition * connectionsMul;
}

/** Wear = Usage × Time — §6.3 */
function wear(usage, time) {
  return usage * time;
}

/** PowerBalance = Generated - Consumed — §7.1 */
function powerBalance(generated, consumed) {
  return generated - consumed;
}

/** DeliveryTime = Distance / Speed × LoadFactor — §8.1 */
function deliveryTime(distance, speed, loadFactor) {
  if (speed <= 0) return Infinity;
  return (distance / speed) * loadFactor;
}

/** Price = Demand / Supply — §12 */
function marketPrice(demand, supply) {
  const eps = 1e-6;
  return Math.max(0.01, demand / (supply + eps));
}

/** Balance = Deposit + Interest — §11.1 */
function balanceWithInterest(deposit, interestAccrued) {
  return deposit + interestAccrued;
}

/** Debt = Principal × Rate × Time — §11.2 (накопленные проценты за интервал) */
function debtInterest(principal, rate, time) {
  return principal * rate * time;
}

/** Trust = Economy + Decisions - Taxes — §13.1 */
function politicalTrust(economyScore, decisionsScore, taxesScore) {
  return economyScore + decisionsScore - taxesScore;
}

/** Relation = Economy + War + History — §14.1 */
function internationalRelation(economy, war, history) {
  return clamp(economy + war + history, -1, 1);
}

/** Power = Economy + Army + Tech — §15 */
function warPower(economy, army, tech) {
  return economy + army + tech;
}

/** Discovery = Experiment × Conditions × Knowledge — §10 */
function discovery(experiment, conditions, knowledge) {
  return experiment * conditions * knowledge;
}

/** FoodQuality ↓ → DiseaseChance ↑ — §9.5 */
function diseaseChanceFromFoodQuality(foodQuality) {
  const fq = clamp(foodQuality, 0, 1);
  return clamp(1 - fq, 0, 0.5);
}

/** HP = MaxHP - Damage + Healing — §3.2 */
function hp(maxHp, damage, healing) {
  return clamp(maxHp - damage + healing, 0, maxHp);
}

module.exports = {
  VITAL_MAX,
  VITAL_MIN,
  REPUTATION_MIN,
  REPUTATION_MAX,
  SURVIVAL_HUNGER_DECAY_PER_TICK,
  SURVIVAL_ACTIVITY_MULT_IDLE,
  SURVIVAL_DAMAGE_WHEN_STARVING,
  FOOD_RESTORE_HUNGER,
  FOOD_RESTORE_ENERGY,
  TEMP_IDEAL,
  TEMP_DRIFT,
  clamp,
  efficiency,
  efficiencyFull,
  resourceValue,
  volumeAfterExtraction,
  productionOutput,
  quality,
  buildingFactor,
  wear,
  powerBalance,
  deliveryTime,
  marketPrice,
  balanceWithInterest,
  debtInterest,
  politicalTrust,
  internationalRelation,
  warPower,
  discovery,
  diseaseChanceFromFoodQuality,
  hp
};
