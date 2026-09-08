-- ====================================================================
-- Aaditech BGA (bga.aaditechs.in) - Hostinger MySQL Production Schema
-- Import this file in Hostinger hPanel -> Databases -> phpMyAdmin
-- ====================================================================

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+05:30";

-- --------------------------------------------------------
-- Table structure for `leads`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leads` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `company` varchar(255) DEFAULT NULL,
  `phone` varchar(64) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `service` varchar(255) NOT NULL,
  `budget` varchar(64) DEFAULT NULL,
  `stage` enum('new','contacted','qualified','quotation','won','lost') NOT NULL DEFAULT 'new',
  `intent_score` int(11) NOT NULL DEFAULT 70,
  `source` varchar(64) NOT NULL DEFAULT 'website',
  `notes` text DEFAULT NULL,
  `ai_suggested_reply` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_phone` (`phone`),
  KEY `idx_stage` (`stage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `reviews`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` varchar(64) NOT NULL,
  `author` varchar(255) NOT NULL,
  `rating` int(11) NOT NULL DEFAULT 5,
  `date` varchar(64) NOT NULL,
  `relative_time` varchar(64) DEFAULT NULL,
  `content` text NOT NULL,
  `sentiment` enum('positive','neutral','negative') NOT NULL DEFAULT 'positive',
  `topic` varchar(128) DEFAULT NULL,
  `is_operational_issue` tinyint(1) NOT NULL DEFAULT 0,
  `replied` tinyint(1) NOT NULL DEFAULT 0,
  `reply_text` text DEFAULT NULL,
  `reply_date` varchar(64) DEFAULT NULL,
  `source` enum('google','facebook','justdial') NOT NULL DEFAULT 'google',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `content_posts`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `content_posts` (
  `id` varchar(64) NOT NULL,
  `channel` varchar(64) NOT NULL,
  `caption` text NOT NULL,
  `image_url` text DEFAULT NULL,
  `status` enum('draft','scheduled','published') NOT NULL DEFAULT 'scheduled',
  `scheduled_time` varchar(64) NOT NULL,
  `hashtags` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `autonomous_actions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `autonomous_actions` (
  `id` varchar(64) NOT NULL,
  `type` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `impact` varchar(128) DEFAULT NULL,
  `action_type` varchar(64) NOT NULL DEFAULT 'automatic',
  `status` enum('completed','queued','pending_approval') NOT NULL DEFAULT 'pending_approval',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table structure for `business_profile`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `business_profile` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `address` text NOT NULL,
  `city` varchar(128) NOT NULL,
  `phone` varchar(64) NOT NULL,
  `email` varchar(255) NOT NULL,
  `website` varchar(255) NOT NULL,
  `whatsapp` varchar(64) NOT NULL,
  `services_json` json DEFAULT NULL,
  `settings_json` json DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Seed Data for Aaditech BGA (bga.aaditechs.in)
-- --------------------------------------------------------
INSERT INTO `business_profile` (`id`, `name`, `category`, `address`, `city`, `phone`, `email`, `website`, `whatsapp`)
VALUES (
  'biz_aaditech',
  'Aaditech Solution',
  'IT Services, Software Development & Local SEO Growth Engine',
  '210, Anant Laxmi Chambers, B-Cabin, Dada Patil Marg, Thane (W)',
  'Thane - Mumbai MMR',
  '+91 22 4963 8603',
  'info@aaditechs.in',
  'https://bga.aaditechs.in',
  '+91 98204 55120'
) ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

INSERT INTO `leads` (`id`, `name`, `company`, `phone`, `email`, `service`, `budget`, `stage`, `intent_score`, `source`, `ai_suggested_reply`)
VALUES
('lead_1', 'Rajesh Singhania', 'Singhania Logistics MMR', '+91 98201 44520', 'rajesh@singhanialogistics.in', 'Android Fleet Management App & Billing ERP', '₹65,000', 'new', 96, 'Website Form', 'Namaste Rajesh ji! Aaditech Solution se humne aapki logistics fleet app requirement review ki. Humne Thane & Navi Mumbai ke 12+ transport operators ke liye custom tracking solutions live kiye hain. Kya hum aaj 4 PM par live demo schedule karein?'),
('lead_2', 'Dr. Sneha Patwardhan', 'Patwardhan Multispecialty Dental', '+91 98192 33410', 'dr.sneha@patwardhandental.com', 'Google 3-Pack Local SEO & WhatsApp Patient Booking', '₹18,000/mo', 'contacted', 88, 'Google 3-Pack Call', 'Hello Dr. Sneha! Thank you for contacting Aaditech Solution. We reviewed your Google clinic listing. Adding WhatsApp appointment booking and localized 3-pack optimization will directly increase high-ticket implant consults. Sharing sample case study!')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

COMMIT;
SET FOREIGN_KEY_CHECKS=1;
