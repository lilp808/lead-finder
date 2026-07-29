Thai Industrial Design System (TIDS)
Design Philosophy

Professional, Clean, Premium, Soft, Calm, Easy to Scan

Keyword

Premium
Enterprise
Soft UI
Spacious
Modern SaaS
Trustworthy
Human Friendly

ผู้ใช้ควรรู้สึกว่า

ใช้งานง่าย
ไม่รก
ดูแพง
อ่านข้อมูลเยอะได้
เหมาะกับองค์กร
Typography

Font

Poppins

น้ำหนักที่ใช้

300 Light
400 Regular
500 Medium
600 SemiBold
700 Bold

ไม่ควรใช้ 800-900

เพราะจะดูแข็งเกินไป

Font Scale

Page Title

36px
Weight 700

Section Title

22px
Weight 600

Card Title

18px
Weight 600

Body

15-16px
Weight 400

Small Text

13px

Caption

12px

Button

14-15px
Weight 600
Color System

Primary

#D4A843

ใช้สำหรับ

Primary Button
Active Menu
Selected
Badge

Hover

#C8992F

Background

#FAFAFA

Card

#FFFFFF

Sidebar

#FFFFFF

Border

#ECECEC

Light Border

#F3F3F3

Text

Primary

#2F2F2F

Secondary

#707070

Muted

#A5A5A5

Status Colors

Success

#30C46C

Info

#4E9EF7

Warning

#E7B64A

Danger

#E15D5D

Background Tags

Success

#ECFAF2

Blue

#EDF5FF

Warning

#FFF7E8
Border Radius

ใช้มุมโค้งทุกอย่าง

Button

10px

Input

10px

Card

14px

Image

12px

Badge

999px

Sidebar

20px
Shadows

Shadow น้อยมาก

0 2px 10px rgba(0,0,0,.04)

หรือ

0 6px 20px rgba(0,0,0,.05)

ไม่ควรใช้เงาหนัก

Layout

Desktop

Sidebar

280px

Content

padding 24-32px

Section spacing

24px

Card spacing

16px
Sidebar

Style

White
Rounded
Floating
Thin Border

Menu Height

44px

Padding

16px

Active Menu

Background

#F8F3E8

Icon

Primary Gold

Text

600

Inactive

Gray

Hover

#FAF7F0
Buttons

Primary

Background

Primary Gold

Text

White

Radius

10px

Height

42px

Transition

200ms

Hover

Dark Gold

Secondary

White

Border

Gray

Icon Button

Square

38x38

Radius

10px

Hover

Light Gray
Inputs

Height

42px

Radius

10px

Border

1px Solid #ECECEC

Focus

Border Gold

Shadow

0 0 0 4px rgba(212,168,67,.15)

Placeholder

Gray

Tables

ไม่ใช้ Table แข็งๆ

ใช้

Card List

แต่ละ Row เป็น Card

สูงประมาณ

140-170px

Padding

18-20px

Hover

#FCFCFC

Border Bottom

#F2F2F2
Listing Card

Structure

Image

↓

Property ID Badge

↓

Property Title

↓

Location

↓

Property Specs

↓

Feature Tags

ใช้ White Space เยอะ

ไม่อัดข้อมูล

Cards

Background

White

Radius

14

Padding

20

Border

Light Gray

Shadow

Very Soft

Badges

Style

Filled

Radius

999px

Padding

4px 12px

Examples

Approved

Green

For Rent

Blue

Factory

Gold

Office

Light Blue

Icons

Style

Outlined

Stroke

2px

Size

18-20px

ใช้

Lucide

หรือ

Heroicons

หรือ

Tabler Icons

ห้ามใช้หลาย Style ปนกัน

Image Style

Radius

12px

Aspect Ratio

4:3

Object Fit

Cover

White Space

ใช้ White Space มาก

เช่น

24px

32px

40px

ไม่ควรใช้

5px
7px
11px

ใช้เลขมาตรฐาน

4
8
12
16
20
24
32
40
48
64
Animation

Duration

180-220ms

Hover

translateY(-1px)

Shadow

เพิ่มเล็กน้อย

Fade

opacity

ไม่ใช้ Animation หวือหวา

UI Feeling

ทุก Component ควรให้ความรู้สึก

✓ Rounded

✓ Spacious

✓ Calm

✓ Clean

✓ Modern SaaS

✓ Premium

✓ Corporate

✓ Soft Contrast

Responsive

Desktop First

Breakpoints

1440+

1280

1024

768

480

Sidebar

Desktop

Expanded

Tablet

Collapsed

Mobile

Drawer
Component Rules

ทุก Project ควรมี Component มาตรฐานเดียวกัน

Button
Input
Select
Search
Textarea
Card
Table Card
Sidebar
Navbar
Dropdown
Badge
Avatar
Modal
Toast
Tabs
Pagination
Breadcrumb
Empty State
Loading Skeleton
Stat Card
Property Card
Action Menu
Status Chip
Design Tokens (CSS Variables)
:root {
  /* Typography */
  --font-family: "Poppins", sans-serif;

  /* Primary */
  --color-primary: #D4A843;
  --color-primary-hover: #C8992F;

  /* Background */
  --color-bg: #FAFAFA;
  --color-surface: #FFFFFF;

  /* Text */
  --color-text: #2F2F2F;
  --color-text-secondary: #707070;
  --color-text-muted: #A5A5A5;

  /* Border */
  --color-border: #ECECEC;

  /* Status */
  --color-success: #30C46C;
  --color-info: #4E9EF7;
  --color-warning: #E7B64A;
  --color-danger: #E15D5D;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 2px 10px rgba(0,0,0,.04);
  --shadow-md: 0 6px 20px rgba(0,0,0,.05);

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
}

Create the UI following the Thai Industrial Design System (TIDS). Use Poppins as the only font family. The visual style should be modern enterprise SaaS, emphasizing clean layouts, generous whitespace, soft rounded corners (10–14px), subtle shadows, premium corporate aesthetics, and excellent readability. The primary color is #D4A843 (gold) with light neutral backgrounds (#FAFAFA), white cards, thin borders (#ECECEC), and dark gray typography (#2F2F2F). Components should feel calm and professional, with smooth 180–220ms transitions, minimal visual noise, consistent spacing based on a 4/8px system, outlined icons (Lucide), rounded badges, and card-based layouts instead of heavy tables. Prioritize usability, visual hierarchy, and consistency so every application (CRM, ERP, HR, Property Management, Inventory, AI Dashboard) appears as part of the same product ecosystem.