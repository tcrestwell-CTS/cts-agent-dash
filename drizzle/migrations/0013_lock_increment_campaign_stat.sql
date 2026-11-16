CREATE OR REPLACE FUNCTION public.increment_campaign_stat(p_campaign_id uuid, p_field text, p_delta integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  case p_field
    when 'total_sent' then update public.campaigns set total_sent = coalesce(total_sent,0) + p_delta where id = p_campaign_id;
    when 'total_delivered' then update public.campaigns set total_delivered = coalesce(total_delivered,0) + p_delta where id = p_campaign_id;
    when 'total_opened' then update public.campaigns set total_opened = coalesce(total_opened,0) + p_delta where id = p_campaign_id;
    when 'total_clicked' then update public.campaigns set total_clicked = coalesce(total_clicked,0) + p_delta where id = p_campaign_id;
    when 'total_bounced' then update public.campaigns set total_bounced = coalesce(total_bounced,0) + p_delta where id = p_campaign_id;
    when 'total_complained' then update public.campaigns set total_complained = coalesce(total_complained,0) + p_delta where id = p_campaign_id;
    when 'total_unsubscribed' then update public.campaigns set total_unsubscribed = coalesce(total_unsubscribed,0) + p_delta where id = p_campaign_id;
    else raise exception 'Invalid field name';
  end case;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_campaign_stat(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_stat(uuid, text, integer) TO service_role;