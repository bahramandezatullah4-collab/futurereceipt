import { Share, Droplets, Wind, Sparkles, Flame, CheckCircle2, Zap } from 'lucide-react';
import type { ImpactSummary } from '@workspace/api-client-react';

function getHealthColor(health: ImpactSummary['treeHealth']) {
  switch (health) {
    case 'thriving': return 'hsl(145 43% 55%)'; // bright green
    case 'healthy': return 'hsl(152 44% 27%)'; // primary green
    case 'resting': return 'hsl(155 10% 42%)'; // muted green/gray
    case 'wilting': return 'hsl(36 54% 68%)'; // brownish/orange
    default: return 'hsl(152 44% 27%)';
  }
}

function getLeafAnimation(health: ImpactSummary['treeHealth']) {
  if (health === 'thriving') return 'animate-leaf-flutter';
  if (health === 'healthy') return 'animate-leaf-sway';
  if (health === 'resting') return 'animate-leaf-still';
  return 'animate-leaf-droop';
}

function TreeSVG({ stage, health }: { stage: ImpactSummary['treeStage'], health: ImpactSummary['treeHealth'] }) {
  const leafColor = getHealthColor(health);
  const trunkColor = health === 'wilting' ? '#6b5744' : '#5c4033';
  const leafAnim = getLeafAnimation(health);

  // SVG dimensions: 200x200
  // Origin at bottom center (100, 180)
  
  const renderSeed = () => (
    <g transform="translate(100, 175)">
      <ellipse cx="0" cy="0" rx="8" ry="5" fill={trunkColor} />
      <path d="M 0 -5 Q 5 -15 10 -5 Z" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -5px' }} />
    </g>
  );

  const renderSprout = () => (
    <g transform="translate(100, 180)">
      <path d="M 0 0 Q -5 -20 0 -40" stroke={trunkColor} strokeWidth="4" fill="none" />
      <path d="M 0 -20 Q -15 -25 -15 -10 Q -5 -5 0 -20" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -20px' }} />
      <path d="M 0 -35 Q 15 -40 15 -25 Q 5 -20 0 -35" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -35px', animationDelay: '0.2s' }} />
    </g>
  );

  const renderSapling = () => (
    <g transform="translate(100, 180)">
      <path d="M 0 0 Q -5 -30 0 -70" stroke={trunkColor} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 0 -30 Q -25 -40 -20 -20 Q -5 -10 0 -30" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -30px' }} />
      <path d="M 0 -50 Q 25 -60 20 -40 Q 5 -30 0 -50" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -50px', animationDelay: '0.3s' }} />
      <path d="M 0 -70 Q -20 -90 -10 -75 Q -5 -65 0 -70" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -70px', animationDelay: '0.5s' }} />
      <circle cx="0" cy="-75" r="12" fill={leafColor} className={leafAnim} style={{ transformOrigin: '0px -75px' }} opacity="0.9" />
    </g>
  );

  const renderTree = () => (
    <g transform="translate(100, 180)">
      {/* Trunk */}
      <path d="M -4 0 L -2 -60 L -15 -90 M 2 -60 L 15 -85 M 4 0 L 2 -60 L 0 -100" stroke={trunkColor} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Leaves/Canopy */}
      <g className={leafAnim} style={{ transformOrigin: '0px -80px' }}>
        <circle cx="-15" cy="-90" r="25" fill={leafColor} opacity="0.95" />
        <circle cx="15" cy="-85" r="22" fill={leafColor} opacity="0.9" />
        <circle cx="0" cy="-110" r="30" fill={leafColor} opacity="0.95" />
        <circle cx="-25" cy="-70" r="18" fill={leafColor} opacity="0.85" />
        <circle cx="25" cy="-65" r="15" fill={leafColor} opacity="0.8" />
      </g>
    </g>
  );

  const renderForest = () => (
    <g>
      {/* Background trees */}
      <g transform="translate(50, 180) scale(0.6)" opacity="0.7">
        <path d="M -4 0 L -2 -60 L -15 -90 M 2 -60 L 15 -85 M 4 0 L 2 -60 L 0 -100" stroke={trunkColor} strokeWidth="8" fill="none" strokeLinecap="round" />
        <g className={leafAnim} style={{ transformOrigin: '0px -80px', animationDelay: '0.4s' }}>
          <circle cx="-15" cy="-90" r="25" fill={leafColor} />
          <circle cx="15" cy="-85" r="22" fill={leafColor} />
          <circle cx="0" cy="-110" r="30" fill={leafColor} />
        </g>
      </g>
      <g transform="translate(150, 180) scale(0.7)" opacity="0.8">
        <path d="M -4 0 L -2 -60 L -15 -90 M 2 -60 L 15 -85 M 4 0 L 2 -60 L 0 -100" stroke={trunkColor} strokeWidth="8" fill="none" strokeLinecap="round" />
        <g className={leafAnim} style={{ transformOrigin: '0px -80px', animationDelay: '0.2s' }}>
          <circle cx="-15" cy="-90" r="25" fill={leafColor} />
          <circle cx="15" cy="-85" r="22" fill={leafColor} />
          <circle cx="0" cy="-110" r="30" fill={leafColor} />
        </g>
      </g>
      {/* Foreground main tree */}
      <g transform="translate(100, 180)">
        <path d="M -4 0 L -2 -60 L -15 -90 M 2 -60 L 15 -85 M 4 0 L 2 -60 L 0 -100" stroke={trunkColor} strokeWidth="8" fill="none" strokeLinecap="round" />
        <g className={leafAnim} style={{ transformOrigin: '0px -80px' }}>
          <circle cx="-15" cy="-90" r="25" fill={leafColor} opacity="0.95" />
          <circle cx="15" cy="-85" r="22" fill={leafColor} opacity="0.9" />
          <circle cx="0" cy="-110" r="30" fill={leafColor} opacity="0.95" />
          <circle cx="-25" cy="-70" r="18" fill={leafColor} opacity="0.85" />
          <circle cx="25" cy="-65" r="15" fill={leafColor} opacity="0.8" />
        </g>
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-xl transition-all duration-700 ease-in-out">
      {/* Ground line */}
      <path d="M 20 180 Q 100 170 180 180" stroke="hsl(var(--muted-foreground)/.3)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {stage === 'seed' && renderSeed()}
      {stage === 'sprout' && renderSprout()}
      {stage === 'sapling' && renderSapling()}
      {stage === 'tree' && renderTree()}
      {stage === 'forest' && renderForest()}
      
      {/* Sparkles for thriving */}
      {health === 'thriving' && (
        <g className="animate-pulse">
          <path d="M 120 70 L 122 75 L 127 77 L 122 79 L 120 84 L 118 79 L 113 77 L 118 75 Z" fill="#Fcd34d" opacity="0.8" />
          <path d="M 70 100 L 71 103 L 74 104 L 71 105 L 70 108 L 69 105 L 66 104 L 69 103 Z" fill="#Fcd34d" opacity="0.6" style={{ animationDelay: '0.5s' }} />
        </g>
      )}
    </svg>
  );
}

export function TreeExperience({ impact }: { impact: ImpactSummary }) {
  const handleShare = async () => {
    const text = `This month I grew my FUTURERECEİPT forest and saved ${impact.treesSaved} trees by choosing digital receipts. Join me in going paperless!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My FUTURERECEİPT Impact',
          text: text,
        });
      } catch (err) {
        // user cancelled or error
      }
    } else {
      navigator.clipboard.writeText(text);
      alert('Impact summary copied to clipboard!');
    }
  };

  const progressPercentage = impact.nextStageAt > 0 
    ? Math.min(100, Math.max(0, (impact.digitalOnlyReceipts / impact.nextStageAt) * 100)) 
    : 100;

  return (
    <section className="rounded-3xl border border-border/80 bg-card p-1 shadow-[var(--shadow-sm)]">
      <div className="rounded-[1.35rem] bg-secondary/20 p-6 md:p-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-primary">
              <Sparkles size={12} />
              Virtual Forest
            </div>
            
            <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-[-.02em] md:text-4xl">
              Your impact is <span className="text-accent">{impact.treeHealth}</span>.
            </h2>
            
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-md">
              Every 50 digital-only receipts equals one eco-score. As your score grows, your forest thrives.
              You are currently at the <strong className="font-semibold text-foreground capitalize">{impact.treeStage}</strong> stage.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-3 pr-5 shadow-sm">
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                  <Droplets size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estimated Water Saved</p>
                  <p className="font-mono text-sm font-semibold">{impact.waterSavedLiters} L</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 p-3 pr-5 shadow-sm">
                <div className="rounded-xl bg-gray-500/10 p-2 text-gray-600 dark:text-gray-400">
                  <Wind size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estimated CO₂ Avoided</p>
                  <p className="font-mono text-sm font-semibold">{impact.co2Avoided} kg</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex w-full max-w-[320px] shrink-0 flex-col items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-b from-primary/5 to-transparent p-6 pt-2">
            <div className="h-[200px] w-[200px]">
              <TreeSVG stage={impact.treeStage} health={impact.treeHealth} />
            </div>
            
            <div className="mt-2 w-full">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{impact.digitalOnlyReceipts} receipts</span>
                <span className="text-primary">Next stage: {impact.nextStageAt}</span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-border/50">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" 
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Score: <span className="text-accent">{impact.ecoPoints} points</span>
              </p>
            </div>
          </div>

        </div>

        <div className="mt-8 border-t border-border/40 pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <Flame size={24} />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">Eco-Streak</h3>
                  <p className="text-sm text-muted-foreground">Log in daily to grow faster.</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Streak</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                    {impact.currentStreak} <span className="text-sm font-medium text-muted-foreground">days</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Longest</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                    {impact.longestStreak} <span className="text-sm font-medium text-muted-foreground">days</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Next Milestone</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                    {impact.nextRewardAt} <span className="text-sm font-medium text-muted-foreground">days</span>
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-2">
                {[...Array(7)].map((_, i) => {
                  const dayNum = impact.currentStreak % 7 === 0 && impact.currentStreak > 0 
                    ? (i + 1)
                    : (impact.currentStreak % 7 > i ? (i + 1) : null);
                  const isChecked = dayNum !== null;
                  
                  return (
                    <div 
                      key={i} 
                      className={`flex h-10 w-10 flex-col items-center justify-center rounded-xl border ${
                        isChecked 
                          ? 'border-orange-500/30 bg-orange-500/10 text-orange-600' 
                          : 'border-border/60 bg-card text-muted-foreground/30'
                      }`}
                    >
                      {isChecked ? <CheckCircle2 size={18} /> : <div className="h-2 w-2 rounded-full bg-border/80" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {impact.ecoBoostActive ? (
              <div className="relative mt-6 flex w-full max-w-[320px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center md:mt-0">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
                
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-[#3d2115] shadow-lg shadow-accent/20">
                  <Zap size={28} className="animate-pulse" />
                </div>
                
                <h4 className="mt-4 font-display text-xl font-bold text-foreground">Eco-Boost Active!</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your sustained streak has unlocked a <strong className="font-semibold text-foreground">{impact.growthMultiplier}x multiplier</strong>. 
                  Every digital receipt now grows your virtual tree twice as fast.
                </p>
              </div>
            ) : (
              <div className="mt-6 flex w-full max-w-[320px] shrink-0 flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-6 text-center md:mt-0">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Zap size={24} />
                </div>
                <h4 className="mt-4 font-display text-lg font-semibold text-foreground">Unlock Eco-Boost</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Keep your streak alive to reach {impact.nextRewardAt} days and unlock a virtual growth multiplier.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end border-t border-border/40 pt-6">
          <button 
            onClick={handleShare}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-card border border-border/80 px-5 text-sm font-semibold text-foreground shadow-sm transition-all hover:bg-secondary/50 hover:border-primary/40 hover:-translate-y-0.5"
          >
            <Share size={16} className="text-primary" />
            Share Impact
          </button>
        </div>

      </div>
    </section>
  );
}
