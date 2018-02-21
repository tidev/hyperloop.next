Rework metabase lifecycle
=====

Currently we do two major passes:
- Fist pass is to collect the ste of frameworks (system, cocoapods, 3rd-party) and generate some metadata about them:
	- location, types (classes), umbrella header, name, type, whether it uses swift, etc.
	- getSystemFrameworks(), generateUserFrameworksMetadata(), generateCocoaPods(), generateSwiftMetabase(), generateUserSourceMappings()?
	-
- We then use this data as our info when comiling user JS code. We can validate frameworks mentioned exist, and can validate class reference (but that's all!)
- We collect the references the user has made and pass along this info to the second pass
- 2nd pass generates the metabase as one all-in JSON file based on the references from user code. BUT we also include the umbrella header of every framework now!
	- This results in *everything* in every framework gettign into the Metabase
- We then generate JS stubs from the metabase. Eveythign in the metabase becomes JS. So again we generate *everything* now.

Goal
====

- Produce per-framework metabase (or at least one for all system frameworks and separate ones for cocoapods/3rd-party)
	- We'd need to do this on demand. Metabase generator would need to be reconfigured to work at a framework level
	- We could hack this right now by passing just umbrella header to metabase generate for framework we care about, and then post-filtering the generated JSON to only things from that framework itself, not dependencies/system! This would be slower/less performant right now, but might be a good start.
- We could then only generate metabase(s) for the referenced frameworks (and their dependencies) on the fly!
	- How to handle dependencies? I don't know if we can gather that in advance of metabse generation for a framework (i.e. from metadata we can gather ahead of time)
	- May need to have the metabase generation output dependency information so we can traverse it to generate the dependency framework metabase
- With full metabase info at compile time we can validate much more than class names: enums, datatypes, structs, functions, protocols, unions, vars
- We could then do some sort of filtering based on references. If we're at least filtering to only used frameworks, then we'll be better than current state.
	- Likely would need another metabase binary flag/option to pass in exact includes and get the full tree of dependencies to generate JS stubs for?
	- Is this possible? Didn't the umbrella header need to get included to fix issues anyhow?

Maybe we can still do two passes? First gathers pure metadata about all found frameworks, but no typeMap?


SYSTEM FRAMEWORKS:
* This looks in a specific sub-dir of the sdk path
* It looks for subdirs ending in .framework
* Then assumes underneath is a dynamic framework, with an umbrella header matching the framework name under a "Headers" folder

USER FRAMEWORKS:
generateUserFrameworksMetadata() seems to just populate typeMap for an existing metadata object
