import React from "react";
import { Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { Button } from "./button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./navigation-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

interface MenuItem {
  title: string;
  url: string;
  description?: string;
  icon?: React.ReactNode;
  items?: MenuItem[];
}

interface Navbar1Props {
  logo?: {
    url: string;
    src?: string;
    alt: string;
    title: string;
  };
  menu?: MenuItem[];
  mobileExtraLinks?: {
    name: string;
    url: string;
  }[];
  auth?: {
    login: {
      text: string;
      url: string;
    };
    signup: {
      text: string;
      url: string;
    };
  };
  fixed?: boolean;
}

const Navbar1 = ({
  logo = {
    url: "/",
    // stable Unsplash image (small square crop)
    src: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=64&h=64&q=60",
    alt: "logo",
    title: "Quarry",
  },
  menu = [{ title: "Home", url: "/" }],
  mobileExtraLinks = [],
  auth,
  fixed = true,
}: Navbar1Props) => {
  const navigate = useNavigate();
  const location = useLocation();

  const go = React.useCallback(
    (url: string) => {
      if (!url) return;
      if (url.startsWith("http")) {
        window.location.href = url;
        return;
      }
      navigate(url);
    },
    [navigate],
  );

  return (
    <section
      className={[
        "py-3",
        fixed ? "fixed top-3 left-4 right-4 z-[100] pointer-events-none" : "",
      ].join(" ")}
    >
      <div className="pointer-events-auto">
        <div
          className={[
            "mx-auto max-w-[1200px] rounded-xl border border-border",
            "bg-[rgba(255,252,242,0.56)] dark:bg-[rgba(255,255,255,0.055)]",
            "backdrop-blur-[16px] shadow-[0_8px_32px_rgba(140,110,60,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
            "px-3 sm:px-4",
          ].join(" ")}
        >
          <nav className="hidden items-center justify-between lg:flex">
            <button
              type="button"
              onClick={() => go(logo.url)}
              className="flex items-center gap-2 py-2"
            >
              {logo.src ? <img src={logo.src} className="h-8 w-8 rounded-md" alt={logo.alt} /> : null}
              <span
                className="text-[0.98rem] font-semibold tracking-[0.12em] uppercase"
                style={{ fontFamily: "var(--font-serif)", color: "var(--accent)" }}
              >
                {logo.title}
              </span>
            </button>

            <div className="flex items-center">
              <NavigationMenu>
                <NavigationMenuList>
                  {menu.map(item => renderMenuItem(item, go, location.pathname))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {auth ? (
              <div className="flex gap-2 py-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={auth.login.url}
                    onClick={e => {
                      e.preventDefault();
                      go(auth.login.url);
                    }}
                  >
                    {auth.login.text}
                  </a>
                </Button>
                <Button asChild size="sm">
                  <a
                    href={auth.signup.url}
                    onClick={e => {
                      e.preventDefault();
                      go(auth.signup.url);
                    }}
                  >
                    {auth.signup.text}
                  </a>
                </Button>
              </div>
            ) : (
              <div className="w-2" />
            )}
          </nav>

          <div className="block lg:hidden">
            <div className="flex items-center justify-between py-2">
              <button type="button" onClick={() => go(logo.url)} className="flex items-center gap-2">
                {logo.src ? <img src={logo.src} className="h-8 w-8 rounded-md" alt={logo.alt} /> : null}
                <span
                  className="text-[0.98rem] font-semibold tracking-[0.12em] uppercase"
                  style={{ fontFamily: "var(--font-serif)", color: "var(--accent)" }}
                >
                  {logo.title}
                </span>
              </button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open menu">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>
                      <button type="button" onClick={() => go(logo.url)} className="flex items-center gap-2">
                        {logo.src ? <img src={logo.src} className="h-8 w-8 rounded-md" alt={logo.alt} /> : null}
                        <span className="text-lg font-semibold">{logo.title}</span>
                      </button>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="my-6 flex flex-col gap-6">
                    <Accordion type="single" collapsible className="flex w-full flex-col gap-3">
                      {menu.map(item => renderMobileMenuItem(item, go))}
                    </Accordion>

                    {mobileExtraLinks.length > 0 ? (
                      <div className="border-t border-border pt-4">
                        <div className="grid grid-cols-2 justify-start gap-2">
                          {mobileExtraLinks.map((link, idx) => (
                            <a
                              key={idx}
                              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-[color:var(--fg-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.18)] dark:hover:bg-[rgba(255,255,255,0.06)]"
                              href={link.url}
                              onClick={e => {
                                e.preventDefault();
                                go(link.url);
                              }}
                            >
                              {link.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {auth ? (
                      <div className="flex flex-col gap-3">
                        <Button asChild variant="outline">
                          <a
                            href={auth.login.url}
                            onClick={e => {
                              e.preventDefault();
                              go(auth.login.url);
                            }}
                          >
                            {auth.login.text}
                          </a>
                        </Button>
                        <Button asChild>
                          <a
                            href={auth.signup.url}
                            onClick={e => {
                              e.preventDefault();
                              go(auth.signup.url);
                            }}
                          >
                            {auth.signup.text}
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const renderMenuItem = (item: MenuItem, go: (url: string) => void, pathname: string) => {
  const isActive = item.url && !item.items && pathname === item.url;

  if (item.items) {
    return (
      <NavigationMenuItem key={item.title} className="text-[color:var(--fg-secondary)]">
        <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
        <NavigationMenuContent>
          <ul className="w-80 p-3">
            <NavigationMenuLink>
              {item.items.map(subItem => (
                <li key={subItem.title}>
                  <a
                    className="flex select-none gap-4 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-[rgba(255,255,255,0.18)] dark:hover:bg-[rgba(255,255,255,0.06)]"
                    href={subItem.url}
                    onClick={e => {
                      e.preventDefault();
                      go(subItem.url);
                    }}
                  >
                    {subItem.icon}
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--fg-primary)]">{subItem.title}</div>
                      {subItem.description ? (
                        <p className="text-sm leading-snug text-[color:var(--fg-secondary)]">{subItem.description}</p>
                      ) : null}
                    </div>
                  </a>
                </li>
              ))}
            </NavigationMenuLink>
          </ul>
        </NavigationMenuContent>
      </NavigationMenuItem>
    );
  }

  return (
    <a
      key={item.title}
      className={[
        "group inline-flex h-9 w-max items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "text-[color:var(--fg-secondary)] hover:text-[color:var(--fg-primary)] hover:bg-[rgba(255,255,255,0.18)] dark:hover:bg-[rgba(255,255,255,0.06)]",
        isActive ? "text-[color:var(--fg-primary)] bg-[rgba(249,115,22,0.10)]" : "",
      ].join(" ")}
      href={item.url}
      onClick={e => {
        e.preventDefault();
        go(item.url);
      }}
    >
      {item.title}
    </a>
  );
};

const renderMobileMenuItem = (item: MenuItem, go: (url: string) => void) => {
  if (item.items) {
    return (
      <AccordionItem key={item.title} value={item.title} className="border-b-0">
        <AccordionTrigger className="py-0 font-semibold hover:no-underline">{item.title}</AccordionTrigger>
        <AccordionContent className="mt-2">
          {item.items.map(subItem => (
            <a
              key={subItem.title}
              className="flex select-none gap-4 rounded-md p-3 leading-none outline-none transition-colors hover:bg-[rgba(255,255,255,0.18)] dark:hover:bg-[rgba(255,255,255,0.06)]"
              href={subItem.url}
              onClick={e => {
                e.preventDefault();
                go(subItem.url);
              }}
            >
              {subItem.icon}
              <div>
                <div className="text-sm font-semibold">{subItem.title}</div>
                {subItem.description ? (
                  <p className="text-sm leading-snug text-[color:var(--fg-secondary)]">{subItem.description}</p>
                ) : null}
              </div>
            </a>
          ))}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <button
      key={item.title}
      type="button"
      onClick={() => go(item.url)}
      className="text-left font-semibold text-[color:var(--fg-primary)]"
    >
      {item.title}
    </button>
  );
};

export { Navbar1 };

