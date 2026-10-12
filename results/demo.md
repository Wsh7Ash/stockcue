# stockcue demo (computed, not hand-written)

Produced by `node tools/generate-artifacts.cjs` against the built-in sample
shop using default UI settings: manual safety stock 10 units, review 7 days,
service level 95% (unused in manual mode).

## Reorder table (urgency-sorted)

```
SKU            | Name                     | OnHand | Avg/Day | Lead | Safety |   ROP | Suggest |  Cover | Urgency   
---------------+--------------------------+--------+---------+------+--------+-------+---------+--------+-----------
BOTT-STEEL-500 | Steel Bottle 500ml       |      5 |    2.15 |   16 |     10 |    45 |      55 |   2.32 | critical  
CAND-BSW-120   | Beeswax Candle 120g      |     18 |    0.58 |   21 |     10 |    23 |       9 |  30.86 | order     
COFF-BEAN-250  | Coffee Beans 250g        |     30 |   11.76 |    7 |     10 |    93 |     145 |   2.55 | order     
PEN-BALL-BLK   | Ballpoint Pen Black      |     25 |   14.57 |    3 |     10 |    54 |     131 |   1.72 | order     
SOAP-LAV-100   | Lavender Soap 100g       |     12 |    3.25 |   12 |     10 |    49 |      60 |   3.69 | order     
SOCK-WOL-GRY   | Wool Socks Grey          |     35 |    3.68 |   11 |     10 |    51 |      42 |   9.51 | order     
TEA-GREEN-100  | Green Tea 100g           |     55 |    7.33 |   10 |     10 |    84 |      80 |    7.5 | order     
TOTE-CAN-NAT   | Canvas Tote Natural      |     14 |    5.94 |    9 |     10 |    64 |      92 |   2.36 | order     
HONEY-WLD-250  | Wildflower Honey 250g    |     60 |    2.15 |   18 |     10 |    49 |       4 |  27.87 | watch     
MUG-CER-WHT    | Ceramic Mug White        |     40 |    1.21 |   14 |     10 |    27 |       0 |   33.1 | ok        
NOTE-A5-LIN    | A5 Lined Notebook        |     90 |    4.64 |    5 |     10 |    34 |       0 |   19.4 | ok        
TEA-HERB-050   | Herbal Tea Sampler 50g   |     48 |       0 |   10 |     10 |    10 |       0 |    inf | no-demand 

Totals: 12 SKUs | 1 critical | 7 order | 1 watch | 2 ok | 1 no-demand
Window: 2026-07-01 + 72 days (through 2026-09-10)
Settings: safety=manual(10 units), review=7 days

```

## Plain-language explanations (per SKU)

| SKU | Urgency | Suggested | Why |
| --- | --- | --- | --- |
| BOTT-STEEL-500 | critical | 55 | 5 on hand is below the 10-unit safety stock (cover 2.32 days). |
| CAND-BSW-120 | order | 9 | 30.86 days cover <= 21-day lead + 17.24 safety days (ROP 23). |
| COFF-BEAN-250 | order | 145 | 2.55 days cover <= 7-day lead + 0.85 safety days (ROP 93). |
| PEN-BALL-BLK | order | 131 | 1.72 days cover <= 3-day lead + 0.69 safety days (ROP 54). |
| SOAP-LAV-100 | order | 60 | 3.69 days cover <= 12-day lead + 3.08 safety days (ROP 49). |
| SOCK-WOL-GRY | order | 42 | 9.51 days cover <= 11-day lead + 2.72 safety days (ROP 51). |
| TEA-GREEN-100 | order | 80 | 7.5 days cover <= 10-day lead + 1.36 safety days (ROP 84). |
| TOTE-CAN-NAT | order | 92 | 2.36 days cover <= 9-day lead + 1.68 safety days (ROP 64). |
| HONEY-WLD-250 | watch | 4 | 27.87 days cover <= 125% of ROP (62); order soon (ROP 49). |
| MUG-CER-WHT | ok | 0 | 33.1 days cover > 14-day lead + 8.26 safety days (ROP 27). |
| NOTE-A5-LIN | ok | 0 | 19.4 days cover > 5-day lead + 2.16 safety days (ROP 34). |
| TEA-HERB-050 | no-demand | 0 | No sales in window; suggestion stays 0. |

## Exported order list

See `results/order-list.csv` (8 line(s)).
