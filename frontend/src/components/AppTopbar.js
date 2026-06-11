import React from 'react';
import { Navbar1 } from './ui/shadcnblocks-com-navbar1';

export default function AppTopbar() {
  return (
    <Navbar1
      fixed
      logo={{
        url: "/",
        src: "",
        alt: "Quarry",
        title: "Quarry",
      }}
      menu={[
        { title: "Home", url: "/" },
        { title: "Ask", url: "/ask" },
        { title: "Notes", url: "/notes" },
        { title: "Sources", url: "/sources" },
        { title: "Artifacts", url: "/artifacts" },
        { title: "Settings", url: "/settings" },
        { title: "Account", url: "/profile" },
      ]}
    />
  );
}
