---
For_Agent: Follow this specification before making large-scale changes to the project
---

# TODO: Sharpening the Axe Is Never Wasted Work

## Disorganized and Undisciplined Means a Mob

If you want to make a change that takes a certain amount of time and is of a certain scale:
- An issue you take on may be snatched up by someone else first, and your effort can only be archived and left to gather dust
- A promise is forgotten, and the corresponding issue is left hanging high
- One merge stirs up a thousand waves: contradictions... conflicts!

## Elegant Collaboration Begins with Knowing That I Know That You Know

So, start a TODO:
- Create a folder named after your change's feature
- Write an index.md, and fill in your fork repository address in the metadata
- What was the original situation? What is your rough intention? What kind of result do you expect?
- Then write down your rough scope, PR, and get to work

Why not an issue:
- Fishing for collaborators in BugReport and featureRequest is a tall order
- An Agent probably won't read issues, but it will definitely glance at documentation

## Step By Step

- Create some Markdown documents in order, named with a number + step intent
- Add each feature unit's old implementation status, intended fix, and expected new implementation status
- If you write down a refined scope, we can follow up faster
- Split each document into a minimal usable functional unit; when you finish your code, add a [DONE] at the end, and upload them together
- Others can then have an Agent pull the corresponding diff from that document's git history, if it hasn't been compressed
- When you complete the last change, you can upload your detailed documentation, experiment records, and stable API, and run automated i18n
- When squashing, try not to put i18n and documentation changes into one PR, as that makes git history less tidy
- Move your folder into [docs/.Meta/Legacy/TODO](../.Meta/Legacy/TODO) with a separate PR

## If You Want to Abandon It

Prefix your named folder with give-up_, and our finisher will quickly inherit your mantle
If you forget about it, our cyber supervisor will check from time to time whether your repository has shown any activity

## Really Too Lazy to Write...

In fact, even if you use an Agent to complete the code, a necessary plan still makes accuracy higher. At first glance, this plan leaves behind a large amount of incompressible history changes, but in fact, because it is highly readable, it will not be a burden on the repository. And large changes launched quickly without sufficient documentation and test records, once problems arise, new changes will instead produce more unmergeable dirty history.

Of course, if you are purely adding or modifying a small amount of code, then it can indeed go live quickly. This document is for those ambitious potential contributors dedicated to large plans
and for Agents that open a goal whenever they are unsure what to do
