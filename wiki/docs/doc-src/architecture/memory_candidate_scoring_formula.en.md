# Memory Mechanism Explained (Simplified Version)

The current memory system can be understood in three steps: first find candidate memories, then let the model decide "add / update / merge / link", and finally write back to the memory store in a fixed order. Only the necessary mathematical expressions are kept below, without too much technical jargon.

The first step is candidate retrieval. The system first extracts the "core question text" from the input, along with only a small piece of necessary context, trying to strip out history records and tool-echo noise; then it splits it into keywords $t_1,\dots,t_K$, and uses tokenization to split the query into retrieval fragments $f_1,\dots,f_F$. In the keyword retrieval stage, the database is used directly for "title contains fragment" matching, instead of first pulling all memories into memory and scanning them. Each memory $m$ gets a total score:

$S(m)=S_{kw}(m)+S_{rev}(m)+S_{sem}^{norm}(m)+S_{graph}(m)$.

Here $S_{kw}$ is the "keyword hit" score, $S_{rev}$ is the "reverse containment" score (the query text directly contains the memory title), $S_{sem}^{norm}$ is the semantic similarity score, and $S_{graph}$ is the relation propagation score. The system sorts and filters by this total score, and finally keeps only the top 15 candidates.

Keyword hits and reverse containment both use the same kind of rank-decay formula. Let memory importance be $p_m$, keyword weight be $W_{kw}$, the ranking constant be $k_0$, and the hit rank be $r$.

For keyword hits, first look at how many fragments are hit in the title. Let $c_m$ be the number of fragments hit by that memory, and $F$ be the total number of fragments; then there is a coverage gain:

$\lambda_m=1+0.6\cdot\frac{c_m}{F}$.

So the single contribution of the keyword stage is:

$\Delta_{kw}=\frac{p_m\cdot W_{kw}}{k_0+r}\cdot\lambda_m$.

The single contribution of reverse containment (the query text directly contains the memory title) is:

$\Delta_{rev}=\frac{p_m\cdot W_{kw}}{k_0+r}$.

The semantic score first computes similarity, then accumulates. Let the semantic weight be $W_{sem}$, the similarity be $sim(m,t)$, and the semantic threshold be $\tau$; a score is only counted when $sim(m,t)\ge\tau$. The contribution of a single keyword is:

$\Delta_{sem}(m,t)=\frac{\sqrt{p_m}}{k_0+r_t}+W_{sem}\cdot sim(m,t)$.

Then length normalization is applied, to avoid "more keywords naturally means a higher score":

$S_{sem}^{norm}(m)=\frac{1}{\sqrt{K}}\sum_{t=1}^{K}\Delta_{sem}(m,t)$.

The relation propagation score is straightforward: if a memory already scores high, the memories connected to it also gain a few points. Let the edge weight be $w_{uv}$, the edge propagation weight be $W_{edge}$, and a small constant be $\beta$; then the increment propagated from $u$ to $v$ is:

$\Delta_{graph}(u\to v)=S(u)\cdot w_{uv}\cdot W_{edge}+\beta\cdot W_{edge}$.

After the total score is obtained, threshold filtering is applied. Let the minimum passing bar be $\theta$; only memories satisfying $S(m)\ge\theta$ are kept, and then the top 15 by descending score are taken as the "old memories shown to the model".

The second step is structured decision-making. The model does not just output free text; it outputs a structured result: $main,new,update,merge,links,user$. The meanings are simple: the main event, memories to add, memories to update, memories to merge, relations to establish, and user preference updates. If the model judges that "this round has no long-term value", it returns an empty object, and the system ends directly without writing anything.

The third step is writing back to the memory store, in a fixed order: first merge, then update, then handle the main event and new entities, and finally build relations. The purpose of this order is to reduce duplication and conflicts. The system also does local high-similarity deduplication: if a new entity is too close to an existing memory, the old memory is reused preferentially, and no new one is created.

Relation building also has hard constraints: both the source and the target must be findable, and the relation must have clear evidence; otherwise no edge is built. The automatic classification flow fills in folder paths for "unclassified memories", but it only affects organization, not the decision of "whether it should be stored".

One final note: the old question-bank tool is still around, but only as a compatibility layer. What is actually running is the mechanism above: "retrieval scoring + structured decision + ordered write-back".
