const { randomInt } = require("node:crypto");

function shuffle(items, pick = randomInt) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Bipartite matching: either assign every giver a distinct valid recipient, or return null.
function assignPairs(ids, restrictions, pick = randomInt) {
  const blocked = new Set(restrictions.map(({ id_retira, id_escolhido }) => `${id_retira}:${id_escolhido}`));
  const choices = new Map(ids.map((giver) => [
    giver,
    shuffle(ids.filter((recipient) => recipient !== giver && !blocked.has(`${giver}:${recipient}`)), pick),
  ]));
  const assignedTo = new Map();

  function assign(giver, visited) {
    for (const recipient of choices.get(giver)) {
      if (visited.has(recipient)) continue;
      visited.add(recipient);
      if (!assignedTo.has(recipient) || assign(assignedTo.get(recipient), visited)) {
        assignedTo.set(recipient, giver);
        return true;
      }
    }
    return false;
  }

  for (const giver of shuffle(ids, pick)) {
    if (!assign(giver, new Set())) return null;
  }
  return [...assignedTo].map(([id_escolhido, id_retira]) => ({ id_retira, id_escolhido }));
}

module.exports = { assignPairs };
