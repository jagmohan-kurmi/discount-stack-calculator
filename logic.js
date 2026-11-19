(function (root, factory) {
  const logic = factory();
  if (typeof module === "object" && module.exports) module.exports = logic;
  root.AppLogic = logic;
})(globalThis, function () {
  function createRecord(records, data, id, fields) {
    if (!id) throw new Error("A record ID is required.");
    const record = {};
    for (const field of fields) {
      const value = String(data[field.name] ?? "").trim();
      if (field.required && !value) throw new Error(`${field.label} is required.`);
      if (field.type === "number" && value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        throw new Error(`${field.label} must be a non-negative number.`);
      }
      record[field.name] = field.type === "number" && value !== "" ? Number(value) : value;
    }
    return [{ id, done: false, createdAt: new Date().toISOString(), ...record }, ...records];
  }

  function updateRecord(records, id, changes) {
    let found = false;
    const updated = records.map((record) => {
      if (record.id !== id) return record;
      found = true;
      return { ...record, ...changes };
    });
    if (!found) throw new Error("Record was not found.");
    return updated;
  }

  function deleteRecord(records, id) {
    return records.filter((record) => record.id !== id);
  }

  function dueStatus(value, now = new Date(), leadDays = 7) {
    if (!value) return null;
    const day = String(value).slice(0, 10);
    const parts = day.split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
    const due = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((due - today) / 86400000);
    if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`, tone: "danger", days };
    if (days === 0) return { label: "Due today", tone: "warning", days };
    if (days <= leadDays) return { label: `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "warning", days };
    return { label: `Due ${day}`, tone: "neutral", days };
  }

  function requiredNumber(values, key) {
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < 0) throw new Error("Enter valid non-negative numbers for all fields.");
    return value;
  }

  function calculate(kind, values) {
    if (kind === "unit-price") {
      const quantityA = requiredNumber(values, "quantityA");
      const quantityB = requiredNumber(values, "quantityB");
      const priceA = requiredNumber(values, "priceA");
      const priceB = requiredNumber(values, "priceB");
      if (!quantityA || !quantityB) throw new Error("Product quantities must be greater than zero.");
      const unitA = priceA / quantityA;
      const unitB = priceB / quantityB;
      const winner = unitA === unitB ? "Same unit price" : `${unitA < unitB ? (values.productA || "Product A") : (values.productB || "Product B")} is cheaper per unit`;
      return [{ label: values.productA || "Product A", value: unitA }, { label: values.productB || "Product B", value: unitB }, { label: "Comparison", value: winner }];
    }
    if (kind === "discount") {
      const price = requiredNumber(values, "originalPrice");
      const percent = requiredNumber(values, "discountPercent");
      const coupon = requiredNumber(values, "couponAmount");
      const tax = requiredNumber(values, "taxPercent");
      if (percent > 100) throw new Error("Discount cannot be greater than 100%.");
      const discounted = Math.max(0, price * (1 - percent / 100) - coupon);
      const final = discounted * (1 + tax / 100);
      return [{ label: "Final estimated price", value: final }, { label: "You save before tax", value: price - Math.max(0, price * (1 - percent / 100) - coupon) }];
    }
    if (kind === "commute") {
      const km = requiredNumber(values, "oneWayKm");
      const days = requiredNumber(values, "workDays");
      const efficiency = requiredNumber(values, "carKmPerLiter");
      const fuel = requiredNumber(values, "fuelPrice");
      const transit = requiredNumber(values, "transitDailyFare");
      const ride = requiredNumber(values, "rideshareDailyFare");
      if (!efficiency) throw new Error("Car efficiency must be greater than zero.");
      const car = km * 2 * days / efficiency * fuel;
      return [{ label: "Car estimate / month", value: car }, { label: "Transit / month", value: transit * days }, { label: "Rideshare / month", value: ride * days }];
    }
    if (kind === "recipe") {
      const amount = requiredNumber(values, "originalAmount");
      const servings = requiredNumber(values, "originalServings");
      const target = requiredNumber(values, "targetServings");
      if (!servings) throw new Error("Original servings must be greater than zero.");
      return [{ label: `${values.ingredient || "Ingredient"} for ${target} servings`, value: `${amount * target / servings} ${values.unit || ""}`.trim() }];
    }
    if (kind === "dilution") {
      const concentrate = requiredNumber(values, "concentrateParts");
      const water = requiredNumber(values, "waterParts");
      const total = requiredNumber(values, "batchMl");
      if (concentrate + water === 0 || total === 0) throw new Error("Mix ratio and batch size must be greater than zero.");
      return [{ label: "Concentrate", value: `${total * concentrate / (concentrate + water)} ml` }, { label: "Water", value: `${total * water / (concentrate + water)} ml` }];
    }
    if (kind === "appliance-cost") {
      const watts = requiredNumber(values, "watts");
      const hours = requiredNumber(values, "hoursPerDay");
      const days = requiredNumber(values, "daysPerMonth");
      const rate = requiredNumber(values, "ratePerKwh");
      const monthly = watts / 1000 * hours * days * rate;
      return [{ label: "Estimated monthly cost", value: monthly }, { label: "Estimated yearly cost", value: monthly * 12 }, { label: "Monthly energy", value: `${watts / 1000 * hours * days} kWh` }];
    }
    if (kind === "timezone") {
      const date = new Date(values.localDateTime);
      if (!values.localDateTime || Number.isNaN(date.getTime())) throw new Error("Choose a valid local date and time.");
      try {
        const from = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
        const to = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: values.targetZone }).format(date);
        return [{ label: "Your device's local time", value: from }, { label: values.targetZone, value: to }];
      } catch {
        throw new Error("Choose a supported destination timezone.");
      }
    }
    throw new Error("No calculator is configured for this app.");
  }

  function recordResult(kind, record) {
    if (kind === "energy") {
      const used = Number(record.currentReading) - Number(record.previousReading);
      if (!Number.isFinite(used) || used < 0) return [{ label: "Reading check", value: "Current reading should be at least the previous reading." }];
      return [{ label: "Estimated usage", value: `${used} kWh` }, { label: "Estimated cost", value: used * Number(record.ratePerKwh) }];
    }
    if (kind === "fuel") {
      const distance = Number(record.distanceKm);
      const liters = Number(record.fuelLiters);
      if (distance > 0 && liters > 0) return [{ label: "Entered efficiency", value: `${(distance / liters).toFixed(2)} km/l` }];
    }
    if (kind === "sleep") {
      const [bedH, bedM] = String(record.bedTime || "").split(":").map(Number);
      const [wakeH, wakeM] = String(record.wakeTime || "").split(":").map(Number);
      if ([bedH, bedM, wakeH, wakeM].every(Number.isFinite)) {
        let minutes = wakeH * 60 + wakeM - (bedH * 60 + bedM);
        if (minutes < 0) minutes += 24 * 60;
        return [{ label: "Time between entries", value: `${Math.floor(minutes / 60)}h ${minutes % 60}m` }];
      }
    }
    if (kind === "reading") {
      const current = Number(record.currentPage);
      const total = Number(record.totalPages);
      if (total > 0) return [{ label: "Reading progress", value: `${Math.min(100, Math.round(current / total * 100))}% (${current}/${total} pages)` }];
    }
    return [];
  }

  return { createRecord, updateRecord, deleteRecord, dueStatus, calculate, recordResult };
});
