import React, { useEffect, useState } from "react";

const ingredients = ["PIZZA", "BURGER", "NOODLES", "SALAD"];

function shuffleDeck(items) {
  const deck = items.flatMap((icon, pairIndex) => [
    { id: `${pairIndex}-a`, icon },
    { id: `${pairIndex}-b`, icon }
  ]);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export default function WaitGame() {
  const [deck, setDeck] = useState(() => shuffleDeck(ingredients));
  const [openCards, setOpenCards] = useState([]);
  const [matchedCards, setMatchedCards] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (openCards.length !== 2) return;
    setLocked(true);
    const [first, second] = openCards;

    if (deck[first].icon === deck[second].icon) {
      setMatchedCards((previous) => [...previous, deck[first].icon]);
      setOpenCards([]);
      setLocked(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setOpenCards([]);
      setLocked(false);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [openCards, deck]);

  function chooseCard(index) {
    if (locked || openCards.includes(index) || matchedCards.includes(deck[index].icon)) return;
    setOpenCards((previous) => [...previous, index]);
    setMoves((previous) => previous + 1);
  }

  function resetGame() {
    setDeck(shuffleDeck(ingredients));
    setOpenCards([]);
    setMatchedCards([]);
    setMoves(0);
    setLocked(false);
  }

  const finished = matchedCards.length === ingredients.length;

  return (
    <section className="wait-game" aria-label="Food matching waiting game">
      <div className="wait-game-copy">
        <span className="eyebrow">WHILE YOUR FOOD IS ON THE WAY</span>
        <h2>Match the ingredients</h2>
        <p>{finished ? "Kitchen champion! You matched every pair." : "Flip two tiles and find all matching pairs."}</p>
      </div>
      <div className="wait-game-board">
        <div className="game-stats">
          <span>Moves <strong>{moves}</strong></span>
          <span>Pairs <strong>{matchedCards.length}/{ingredients.length}</strong></span>
          <button type="button" onClick={resetGame} aria-label="Restart game"><i className="bi bi-arrow-counterclockwise"></i></button>
        </div>
        <div className="game-grid">
          {deck.map((card, index) => {
            const isOpen = openCards.includes(index) || matchedCards.includes(card.icon);
            return (
              <button
                key={card.id}
                type="button"
                className={isOpen ? "game-card open" : "game-card"}
                onClick={() => chooseCard(index)}
                aria-label={isOpen ? card.icon : "Hidden ingredient"}
                disabled={matchedCards.includes(card.icon)}
              >
                <span>{isOpen ? card.icon : "?"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
