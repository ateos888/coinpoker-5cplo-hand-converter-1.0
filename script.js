function convertCard(card) {
  const suits = {
    's': '♠',
    'h': '♥',
    'd': '♦',
    'c': '♣'
  };

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);

  return `[${rank}${suits[suit]}]`;
}

function convertHand() {
  const rawText = document.getElementById('input').value;
  const lines = rawText.split('\n');

  let smallBlindPlayer = '';
  let bigBlindPlayer = '';
  let smallBlindStack = 0;
  let bigBlindStack = 0;
  let bbAmount = 0;

  // Parse the blinds from the first line
  const blindLine = lines.find(line => line.includes("Pot Limit"));
  if (blindLine) {
    const match = blindLine.match(/\(([\d.]+)\/([\d.]+) ante ([\d.]+)\)/);
    if (match) {
      bbAmount = parseFloat(match[2]);
    }
  }

  for (const line of lines) {
    if (line.includes("Seat 1:")) {
      const match = line.match(/Seat 1: ([^(]+) \(([\d.]+) in chips\)/);
      if (match) {
        smallBlindPlayer = match[1].trim();
        smallBlindStack = parseFloat(match[2]);
      }
    }
    if (line.includes("Seat 2:")) {
      const match = line.match(/Seat 2: ([^(]+) \(([\d.]+) in chips\)/);
      if (match) {
        bigBlindPlayer = match[1].trim();
        bigBlindStack = parseFloat(match[2]);
      }
    }
  }

  // Convert chip stacks to dollars (assume 50 chips = $0.50)
  const sbBB = (smallBlindStack / bbAmount).toFixed(0);
  const bbBB = (bigBlindStack / bbAmount).toFixed(0);
  const sbDollars = smallBlindStack.toFixed(2);
  const bbDollars = bigBlindStack.toFixed(2);

  const playerBlock =
    `[b][color=#C4302B]${smallBlindPlayer} (SB): $${sbDollars} (${sbBB} bb)[/color][/b]\n` +
    `[b][color=#C4302B]${bigBlindPlayer} (BB): $${bbDollars} (${bbBB} bb)[/color][/b]`;

  // Debugging: Log player block
  console.log("Player Block:", playerBlock);

  // Parse Preflop Actions
  const preflopLines = [];
  let preflopStarted = false;

  for (const line of lines) {
    if (line.includes("*** HOLE CARDS ***")) {
      preflopStarted = true;
      continue;
    }
    if (line.startsWith("***")) break;
    if (preflopStarted) preflopLines.push(line);
  }

  let preflopText = '[b]Pre-Flop:[/b] ';
  let pot = 0;

  const actionMap = preflopLines.map(line => {
    let player = line.split(':')[0];
    let actionPart = line.split(':')[1]?.trim() || '';

    if (actionPart.includes('raises')) {
      const toMatch = actionPart.match(/raises .* to (\d+)/);
      if (toMatch) {
        const amount = parseInt(toMatch[1]);
        pot += amount;
        return `[color=#C51F1F]${player} raises to $${parseFloat(amount).toFixed(2)}[/color]`;
      }
    }
    if (actionPart.includes('calls')) {
      const amount = parseInt(actionPart.match(/calls (\d+)/)?.[1] || 0);
      pot += amount;
      return `${player} calls $${parseFloat(amount).toFixed(2)}`;
    }
    if (actionPart.includes('folds')) {
      return `${player} folds`;
    }
    return null;
  }).filter(Boolean);

  preflopText += `($${pot.toFixed(2)})    \n` + actionMap.join(', ');

  // Debugging: Log preflop text
  console.log("Pre-Flop Text:", preflopText);

  // === FLOP ===
  let flopCards = '';
  let flopLines = [];
  let inFlop = false;

  for (const line of lines) {
    if (line.startsWith('*** FLOP ***')) {
      inFlop = true;
      const match = line.match(/\[(.*?)\]/);
      if (match) {
        const cards = match[1].split(' ');
        flopCards = cards.map(convertCard).join(' ');
      }
      continue;
    }
    if (line.startsWith('***') && inFlop) break;
    if (inFlop) flopLines.push(line);
  }

  const { text: flopText, pot: flopPot } = parseStreet("FLOP", pot);

  // Debugging: Log flop text
  console.log("Flop Text:", flopText);

  // === TURN + RIVER ===
  function parseStreet(streetName, previousPot) {
    let streetCards = '';
    let streetLines = [];
    let inStreet = false;
    let pot = previousPot;

    for (const line of lines) {
      if (line.startsWith(`*** ${streetName.toUpperCase()} ***`)) {
        inStreet = true;
        const match = line.match(/\[(.*?)\]/g); // get last board
        if (match) {
          const lastBoard = match[match.length - 1];
          const cards = lastBoard.replace(/\[|\]/g, '').split(' ');
          streetCards = cards.map(convertCard).join(' ');
        }
        continue;
      }
      if (line.startsWith('***') && inStreet) break;
      if (inStreet) streetLines.push(line);
    }

    const actions = [];

    for (const line of streetLines) {
      if (line.includes("bets")) {
        const match = line.match(/(.*): bets (\d+(\.\d+)?)/);
        if (match) {
          const player = match[1].trim();
          const amount = parseFloat(match[2]);
          pot += amount;
          actions.push(`[color=#C51F1F]${player} bets $${parseFloat(amount).toFixed(2)}[/color]`);
        }
      } else if (line.includes("raises")) {
        const match = line.match(/(.*): raises .* to (\d+(\.\d+)?)/);
        if (match) {
          const player = match[1].trim();
          const amount = parseFloat(match[2]);
          pot += amount;

          const isAllIn = line.includes("is all-in") || line.includes("and is all-in");
          actions.push(`[color=#C51F1F]${player} raises to ${isAllIn ? "all-in " : ""}$${parseFloat(amount).toFixed(2)}[/color]`);
        }
      } else if (line.includes("calls")) {
        const match = line.match(/(.*): calls (\d+(\.\d+)?)/);
        if (match) {
          const player = match[1].trim();
          const amount = parseFloat(match[2]);
          pot += amount;

          const isAllIn = line.includes("is all-in") || line.includes("and is all-in");
          actions.push(`${player} calls ${isAllIn ? "all-in " : ""}$${parseFloat(amount).toFixed(2)}`);
        }
      } else if (line.includes("checks")) {
        const player = line.split(':')[0];
        actions.push(`${player} checks`);
      } else if (line.includes("folds")) {
        const player = line.split(':')[0];
        actions.push(`${player} folds`);
      }
    }

    const text = `\n\n[b]${streetName}:[/b] ($${pot.toFixed(2)}) ${streetCards} [color=#009B00](2 players)[/color]\n` + actions.join(', ');
    return { text, pot };
  }

  const { text: turnText, pot: turnPot } = parseStreet("TURN", pot);
  const { text: riverText, pot: finalPot } = parseStreet("RIVER", turnPot);

  // Debugging: Log turn and river text
  console.log("Turn Text:", turnText);
  console.log("River Text:", riverText);

  // === SUMMARY ===
  let summaryText = '';

  const collectedLine = lines.find(line => line.includes('collected'));
  if (collectedLine) {
    const match = collectedLine.match(/(.*) collected (\d+(\.\d+)?) from pot/);
    if (match) {
      const winner = match[1].trim();
      const amount = parseFloat(match[2]);

      summaryText += `\n\n[b]Total pot:[/b] $${(amount).toFixed(2)}\n`;
      summaryText += `[b]${winner} won pot:[/b] $${(amount).toFixed(2)}\n`;

      const muckLine = lines.find(line => line.includes(`${winner}: doesn't show`));
      if (muckLine) {
        summaryText += `${winner} mucks\n`;
      }
    }
  }

  // Debugging: Log summary text
  console.log("Summary Text:", summaryText);

  // === SHOWDOWN HANDS ===
  const showdownStart = lines.findIndex(line => line.includes('*** SHOW DOWN ***'));
  let showdownText = '';

  if (showdownStart !== -1) {
    showdownText += `\n\n[b]Showdown:[/b]\n`;

    const shownHands = new Set();
    let winnerName = '';
    let wonAmount = '';
    let winningHandText = '';

    for (let i = showdownStart + 1; i < lines.length; i++) {
      const line = lines[i];

      // Hand reveal
      if (line.includes("shows [")) {
        const match = line.match(/(.*): shows \[(.*)\](?: \((.*?)\))?/);
        if (match) {
          const player = match[1].trim();
          if (shownHands.has(player)) continue;
          shownHands.add(player);

          const rawCards = match[2].trim();
          const cards = rawCards.split(' ').map(convertCard).join(' ');

          if (player === winnerName) {
            winningHandCards = cards;
          }
          const handDesc = match[3] ? ` (${match[3]})` : '';
          const position = player === smallBlindPlayer ? 'SB' : 'BB';

          showdownText += `${player} (${position}) shows ${cards}${handDesc}\n`;
        }
      }

      // Muck line (from summary)
      if (line.includes("mucked")) {
        const match = line.match(/(.*) \(button|big blind\) mucked/);
        if (match) {
          const player = match[1].trim();
          const position = player === smallBlindPlayer ? 'SB' : 'BB';
          showdownText += `${player} (${position}) mucks\n`;
        }
      }

      // Winner with hand (CoinPoker style)
      if (line.includes("and won") && line.includes("with")) {
        const match = line.match(/(.*) showed .* and won \(([\d.]+)\) with (.*)/);
        if (match) {
          winnerName = match[1].trim();
          wonAmount = match[2];
          winningHandText = match[3].trim();
        }
      }

      if (line.includes("*** SUMMARY ***")) break;
    }

    if (winnerName && wonAmount && winningHandText) {
      showdownText += `[b]${winnerName} won pot:[/b] $${parseFloat(wonAmount).toFixed(2)} with ${winningHandCards} (${winningHandText})\n`;
    }
  }

  // Debugging: Log showdown text
  console.log("Showdown Text:", showdownText);

  // Final combined output
  const output = `${playerBlock}\n\n${preflopText}${flopText}${turnText}${riverText}${showdownText}${summaryText}`;
  document.getElementById('output').textContent = output;

  // Debugging: Log final output
  console.log("Final Output:", output);
}
