# Roll Book Mathematical Formulations & Proofs

This document details the mathematical models used throughout **Roll Book** for calculating attendance percentages, skippable lecture margins, and consecutive attendance recovery requirements.

---

## 📌 Variable Definitions

- $P$: Total verified lectures attended (**Present**)
- $A$: Total verified lectures missed (**Absent**)
- $T = P + A$: Total lectures conducted (**Held**)
- $R$: Target attendance requirement threshold fraction ($R = \frac{\text{Required \%}}{100}$, e.g. $0.75$ for $75\%$)
- $\text{pct}$: Current verified attendance percentage

$$\text{pct} = \begin{cases} 100\% & \text{if } T = 0 \\ \frac{P}{T} \times 100 & \text{if } T > 0 \end{cases}$$

---

## 🟢 1. Safe Zone Margin ($\text{pct} \ge \text{Required \%}$)

When your current attendance meets or exceeds the required threshold, the **Safe Zone Margin** represents the maximum number of consecutive future lectures you can miss ($x$) without your overall attendance dropping below $R$:

$$\frac{P}{T + x} \ge R$$

Solving for $x$:

$$P \ge R(T + x)$$

$$\frac{P}{R} \ge T + x$$

$$x \le \frac{P}{R} - T$$

Since the number of lectures must be an integer, we take the floor:

$$\text{Max Skippable Classes} = \left\lfloor \frac{P}{R} - T \right\rfloor$$

### Example:
- $P = 18$, $A = 2$, $T = 20$, $R = 0.75$ ($90\%$ attendance):
  $$\text{Max Skippable} = \left\lfloor \frac{18}{0.75} - 20 \right\rfloor = \lfloor 24 - 20 \rfloor = 4 \text{ classes}$$
- Verification: If you miss the next 4 classes, $P = 18$, $T = 24 \implies \frac{18}{24} = 75.0\%$.

---

## 🔴 2. Recovery Zone Margin ($\text{pct} < \text{Required \%}$)

When your current attendance is below the required threshold, the **Recovery Zone Margin** represents the minimum number of consecutive future lectures you must attend ($y$) to restore your attendance to at least $R$:

$$\frac{P + y}{T + y} \ge R$$

Solving for $y$:

$$P + y \ge R(T + y)$$

$$P + y \ge R \cdot T + R \cdot y$$

$$y(1 - R) \ge R \cdot T - P$$

$$y \ge \frac{R \cdot T - P}{1 - R}$$

Taking the ceiling to ensure the integer count satisfies the inequality:

$$\text{Must Attend Next} = \left\lceil \frac{R \cdot T - P}{1 - R} \right\rceil$$

### Edge Cases:
1. **$R = 1.0$ ($100\%$ requirement)**:
   If any lecture has been missed ($A > 0$), $\frac{P + y}{T + y}$ asymptotically approaches $1$ but will never equal $100\%$. The formula division by $1 - R = 0$ is trapped and correctly reported as *Mathematically impossible to achieve once missed*.
2. **$T = 0$ (No classes held yet)**:
   Returns $0$ with status *No classes held yet*.

### Example:
- $P = 10$, $A = 10$, $T = 20$, $R = 0.75$ ($50\%$ attendance):
  $$\text{Must Attend Next} = \left\lceil \frac{0.75 \times 20 - 10}{1 - 0.75} \right\rceil = \left\lceil \frac{15 - 10}{0.25} \right\rceil = \left\lceil \frac{5}{0.25} \right\rceil = 20 \text{ consecutive classes}$$
- Verification: If you attend 20 consecutive classes, $P = 30$, $T = 40 \implies \frac{30}{40} = 75.0\%$.

---

## 📈 3. Projected Trajectory Simulation

When planning future lectures in the Calendar view:

- $P_{\text{plan}}$: Planned future lectures marked as *Attend*
- $A_{\text{plan}}$: Planned future lectures marked as *Skip*

$$\text{Projected \%} = \frac{P + P_{\text{plan}}}{(P + A) + (P_{\text{plan}} + A_{\text{plan}})} \times 100$$

$$\Delta \% = \text{Projected \%} - \text{Current Actual \%}$$
