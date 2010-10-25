BUILDDIR := build
IMGDIR := images
LOCALESDIR := _locales
IMGBUILDDIR := $(BUILDDIR)/$(IMGDIR)
LOCALESBUILDDIR := $(BUILDDIR)/$(LOCALESDIR)
images := disp_ico_16.png disp_ico_48.png disp_ico_128.png
static := license.txt
css := options.css
js := bg.js  jquery-1.4.3.min.js  keyboard_shortcuts.js  options.js  popup.js
html := bg.html  options.html  popup.html
manifest := manifest.json

collect : $(images) $(static) $(css) $(js) $(html) $(manifest) | $(BUILDDIR)

release : clean collect
	cd $(BUILDDIR) && zip -r -9 ../../BrowseQueue-`git describe --tags`.zip .
	
$(BUILDDIR) :
	mkdir $(BUILDDIR)

$(IMGBUILDDIR) : | $(BUILDDIR)
	mkdir $(IMGBUILDDIR)

$(LOCALESBUILDDIR) : | $(BUILDDIR)
	mkdir $(LOCALESBUILDDIR)

$(images) : | $(IMGBUILDDIR)
	cp $(IMGDIR)/$@ $(IMGBUILDDIR)/$@

$(static) : | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(css) : | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(js) : locales | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(html) : $(js) $(css) | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

$(manifest) : locales | $(BUILDDIR)
	cp $@ $(BUILDDIR)/$@

locales : | $(LOCALESBUILDDIR)
	cp --recursive $(LOCALESDIR)/ $(LOCALESBUILDDIR)/

.PHONY : clean
clean :
	-rm -r $(BUILDDIR)
